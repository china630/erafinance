import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PaymentOrderStatus,
  Prisma,
  TariffTier,
} from "@erafinance/database";
import { PrismaService } from "../../../prisma/prisma.service";
import { SystemConfigService } from "../../../system-config/system-config.service";
import { decryptText } from "../../../security/pii-crypto.util";
import { PaymentProviderService } from "../../../billing/payment-provider.service";
import {
  DRAKARIS_STATUS_DESCRIPTIONS,
  DrakarisStatus,
  type DrakarisEnvelope,
} from "./drakaris-status";

export type DrakarisClientRow = {
  id: string;
  name: string;
  balance: number;
  currency: string;
};

function normalizeDrakarisClientId(raw: string): string {
  return raw.trim().toUpperCase();
}

function maskOwnerName(firstName: string | null, lastName: string | null): string {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();
  const initial = f.length > 0 ? `${f[0]!.toUpperCase()}.` : "";
  const lastMasked = l.length > 2 ? `${l.slice(0, 2)}****` : "****";
  return `${initial} ${lastMasked}`.trim();
}

type OrgSettingsDrakaris = {
  drakaris?: {
    /** When false, spec 404 — payments not available for this client. Default true if omitted. */
    paymentsEnabled?: boolean;
  };
};

@Injectable()
export class DrakarisService {
  private readonly logger = new Logger(DrakarisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
    @Inject(forwardRef(() => PaymentProviderService))
    private readonly paymentProvider: PaymentProviderService,
  ) {}

  isGloballyEnabled(): boolean {
    return this.config.get<string>("DRAKARIS_ENABLED", "0")?.trim() === "1";
  }

  private drakarisPaymentsAllowedForOrg(
    settings: Prisma.JsonValue,
    hasClientId: boolean,
  ): boolean {
    if (!hasClientId) return false;
    const s = settings as OrgSettingsDrakaris;
    if (s?.drakaris?.paymentsEnabled === false) return false;
    return true;
  }

  private async loadOrganizationByExternalId(externalId: string) {
    const id = normalizeDrakarisClientId(externalId);
    return this.prisma.organization.findFirst({
      where: { drakarisClientId: id },
      include: {
        owner: {
          select: {
            firstNameCipher: true,
            lastNameCipher: true,
          },
        },
        subscription: { select: { currentTier: true } },
      },
    });
  }

  async checkClient(externalId: string): Promise<DrakarisEnvelope> {
    const id = normalizeDrakarisClientId(externalId);
    if (!/^[A-Z0-9]+$/.test(id)) {
      return this.envelope(DrakarisStatus.INVALID_CLIENT_ID, null);
    }

    if (!this.isGloballyEnabled()) {
      return this.envelope(DrakarisStatus.PAYMENTS_DISABLED, null);
    }

    const org = await this.loadOrganizationByExternalId(id);
    if (!org) {
      return this.envelope(DrakarisStatus.INVALID_CLIENT_ID, null);
    }

    if (
      !this.drakarisPaymentsAllowedForOrg(org.settings, Boolean(org.drakarisClientId))
    ) {
      return this.envelope(DrakarisStatus.NOT_AVAILABLE_FOR_CLIENT, null);
    }

    const firstName = org.owner?.firstNameCipher
      ? decryptText(org.owner.firstNameCipher)
      : null;
    const lastName = org.owner?.lastNameCipher
      ? decryptText(org.owner.lastNameCipher)
      : null;

    const pendingTotal = await this.prisma.paymentOrder.aggregate({
      where: {
        organizationId: org.id,
        status: PaymentOrderStatus.PENDING,
        provider: "drakaris",
      },
      _sum: { amountAzn: true },
    });

    const balance = Number(pendingTotal._sum.amountAzn ?? 0);

    return this.envelope(DrakarisStatus.OK, {
      id,
      name: maskOwnerName(firstName, lastName),
      balance,
      currency: org.currency.toUpperCase(),
    });
  }

  /**
   * Body fields per PDF: id, amount (coins), currency, transaction-id.
   */
  async topUpBalance(
    externalId: string,
    body: Record<string, unknown>,
  ): Promise<DrakarisEnvelope> {
    const idParam = normalizeDrakarisClientId(externalId);
    if (!/^[A-Z0-9]+$/.test(idParam)) {
      return this.envelope(DrakarisStatus.VALIDATION_ERROR, null);
    }

    if (!this.isGloballyEnabled()) {
      return this.envelope(DrakarisStatus.PAYMENTS_DISABLED, null);
    }

    const org = await this.loadOrganizationByExternalId(idParam);
    if (!org) {
      return this.envelope(DrakarisStatus.INVALID_CLIENT_ID, null);
    }

    if (
      !this.drakarisPaymentsAllowedForOrg(org.settings, Boolean(org.drakarisClientId))
    ) {
      return this.envelope(DrakarisStatus.NOT_AVAILABLE_FOR_CLIENT, null);
    }

    const rawAmount = body.amount;
    const currencyRaw = body.currency;
    const txnRaw =
      (typeof body["transaction-id"] === "string"
        ? body["transaction-id"]
        : null) ??
      (typeof body.transactionId === "string" ? body.transactionId : null);
    const bodyId =
      typeof body.id === "string" ? normalizeDrakarisClientId(body.id) : null;

    if (
      rawAmount == null ||
      typeof currencyRaw !== "string" ||
      !txnRaw ||
      typeof txnRaw !== "string"
    ) {
      return this.envelope(DrakarisStatus.VALIDATION_ERROR, null);
    }

    const amountNum =
      typeof rawAmount === "number"
        ? rawAmount
        : typeof rawAmount === "string"
          ? Number(rawAmount)
          : NaN;
    if (!Number.isFinite(amountNum) || amountNum <= 0 || !Number.isInteger(amountNum)) {
      return this.envelope(DrakarisStatus.VALIDATION_ERROR, null);
    }

    if (bodyId != null && bodyId !== idParam) {
      return this.envelope(DrakarisStatus.VALIDATION_ERROR, null);
    }

    const currency = currencyRaw.trim().toUpperCase();
    if (currency !== org.currency.toUpperCase()) {
      return this.envelope(DrakarisStatus.CURRENCY_MISMATCH, null);
    }

    const amountAzn = new Prisma.Decimal(amountNum).div(new Prisma.Decimal(100));

    const tier = org.subscription?.currentTier ?? TariffTier.TIER_1;
    const monthlyPrice = await this.systemConfig.getBillingPriceAzn(tier);
    const months = Math.max(
      1,
      Math.floor(Number(amountAzn.toString()) / monthlyPrice),
    );

    const existing = await this.prisma.paymentOrder.findUnique({
      where: { idempotencyKey: txnRaw },
    });

    if (existing?.status === PaymentOrderStatus.PAID) {
      return this.envelope(DrakarisStatus.DUPLICATE_TRANSACTION, null);
    }

    try {
      if (existing?.status === PaymentOrderStatus.PENDING) {
        await this.paymentProvider.finalizePaidOrderPublic(existing.id);
        return this.envelope(DrakarisStatus.OK, {
          id: idParam,
          amount: amountNum,
          currency,
          "transaction-id": txnRaw,
        });
      }

      const order = await this.prisma.paymentOrder.create({
        data: {
          organizationId: org.id,
          amountAzn,
          monthsApplied: months,
          description: `Drakaris/yığım subscription (${months} mo.)`,
          idempotencyKey: txnRaw,
          status: PaymentOrderStatus.PENDING,
          provider: "drakaris",
          providerTxnId: txnRaw,
          metadata: { source: "drakaris_inbound" } as Prisma.InputJsonValue,
        },
      });

      await this.paymentProvider.finalizePaidOrderPublic(order.id);

      return this.envelope(DrakarisStatus.OK, {
        id: idParam,
        amount: amountNum,
        currency,
        "transaction-id": txnRaw,
      });
    } catch (e) {
      this.logger.error(`Drakaris topUpBalance failed: ${String(e)}`);
      return this.envelope(DrakarisStatus.INTERNAL_ERROR, null);
    }
  }

  private envelope<T>(
    status: number,
    data: T | null,
  ): DrakarisEnvelope<T | null> {
    return {
      status,
      description: DRAKARIS_STATUS_DESCRIPTIONS[status] ?? "Unknown status",
      data,
    };
  }
}

