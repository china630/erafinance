import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@erafinance/database";
import QRCode from "qrcode";
import { addMonths } from "date-fns";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

function generatePartnerCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

/** Exported for unit tests (tier ladder vs referred org count). */
export function referralCommissionTierRate(referredOrgCount: number): number {
  if (referredOrgCount < 10) return 10;
  if (referredOrgCount < 50) return 15;
  return 20;
}

function parseBillingPeriod(period: string): { year: number; month: number } {
  const [ys, ms] = period.split("-");
  const year = Number.parseInt(ys ?? "", 10);
  const month = Number.parseInt(ms ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new BadRequestException({ code: "INVALID_BILLING_PERIOD", message: period });
  }
  return { year, month };
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private publicWebBase(): string {
    return (
      this.config.get<string>("WEB_APP_PUBLIC_URL") ??
      this.config.get<string>("WEB_URL") ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
  }

  async attachReferralOnSignupTx(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      organizationCreatedAt: Date;
      referralCode?: string | null;
    },
  ): Promise<void> {
    const raw = params.referralCode?.trim();
    if (!raw) return;
    const code = raw.toUpperCase();
    const partner = await tx.partner.findUnique({ where: { code } });
    if (!partner) {
      this.logger.warn(`Referral signup: unknown partner code ${code}`);
      return;
    }
    await tx.referral.create({
      data: {
        partnerId: partner.id,
        organizationId: params.organizationId,
        signupAt: params.organizationCreatedAt,
        windowEndsAt: addMonths(params.organizationCreatedAt, 12),
        isActive: true,
        source: "register",
      },
    });
  }

  async listPartnersForAdmin() {
    return this.prisma.partner.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { referrals: true } },
      },
    });
  }

  async createPartnerForAdmin(input: {
    displayName: string;
    isCorporate?: boolean;
    fixedRatePercent?: number | null;
    ownerUserId?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  }) {
    for (let i = 0; i < 5; i++) {
      const code = generatePartnerCode();
      try {
        return await this.prisma.partner.create({
          data: {
            code,
            displayName: input.displayName.trim(),
            isCorporate: Boolean(input.isCorporate),
            fixedRatePercent:
              input.fixedRatePercent != null
                ? new Prisma.Decimal(input.fixedRatePercent)
                : null,
            ...(input.ownerUserId
              ? { ownerUser: { connect: { id: input.ownerUserId } } }
              : {}),
            contactEmail: input.contactEmail?.trim() || null,
            contactPhone: input.contactPhone?.trim() || null,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new BadRequestException("Could not allocate unique partner code");
  }

  async updatePartnerForAdmin(
    id: string,
    patch: {
      displayName?: string;
      isCorporate?: boolean;
      fixedRatePercent?: number | null;
      ownerUserId?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
    },
  ) {
    const data: Prisma.PartnerUpdateInput = {};
    if (patch.displayName !== undefined) data.displayName = patch.displayName.trim();
    if (patch.isCorporate !== undefined) data.isCorporate = patch.isCorporate;
    if (patch.fixedRatePercent !== undefined) {
      data.fixedRatePercent =
        patch.fixedRatePercent == null
          ? null
          : new Prisma.Decimal(patch.fixedRatePercent);
    }
    if (patch.ownerUserId !== undefined) {
      data.ownerUser =
        patch.ownerUserId == null
          ? { disconnect: true }
          : { connect: { id: patch.ownerUserId } };
    }
    if (patch.contactEmail !== undefined) data.contactEmail = patch.contactEmail;
    if (patch.contactPhone !== undefined) data.contactPhone = patch.contactPhone;
    try {
      return await this.prisma.partner.update({ where: { id }, data });
    } catch {
      throw new NotFoundException("Partner not found");
    }
  }

  async renderPartnerQrPng(partnerId: string): Promise<Buffer> {
    const p = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!p) throw new NotFoundException("Partner not found");
    const url = `${this.publicWebBase()}/register?ref=${encodeURIComponent(p.code)}`;
    return QRCode.toBuffer(url, { type: "png", width: 320, margin: 2 });
  }

  async renderPartnerQrPngForOwnerUser(userId: string): Promise<Buffer> {
    const partner = await this.prisma.partner.findFirst({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (!partner) {
      throw new NotFoundException({
        code: "PARTNER_PROFILE_MISSING",
        message: "No partner profile linked to this user (ownerUserId).",
      });
    }
    return this.renderPartnerQrPng(partner.id);
  }

  async getPartnerDashboard(userId: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { ownerUserId: userId },
      include: {
        referrals: {
          where: { isActive: true },
          select: { id: true, organizationId: true, windowEndsAt: true },
        },
        _count: { select: { referrals: true } },
      },
    });
    if (!partner) {
      throw new NotFoundException({
        code: "PARTNER_PROFILE_MISSING",
        message: "No partner profile linked to this user (ownerUserId).",
      });
    }
    const referredTotal = await this.prisma.referral.count({
      where: { partnerId: partner.id },
    });
    const commissions = await this.prisma.referralCommission.findMany({
      where: {
        referral: { partnerId: partner.id },
        status: "ACCRUED",
      },
      select: { amountAzn: true },
    });
    const pendingAzn = commissions.reduce(
      (s, r) => s + Number(r.amountAzn),
      0,
    );
    return {
      partner: {
        id: partner.id,
        code: partner.code,
        displayName: partner.displayName,
        isCorporate: partner.isCorporate,
        fixedRatePercent: partner.fixedRatePercent?.toString() ?? null,
      },
      referralUrl: `${this.publicWebBase()}/register?ref=${encodeURIComponent(partner.code)}`,
      stats: {
        referredOrganizationsTotal: referredTotal,
        activeReferrals: partner.referrals.length,
        pendingCommissionAzn: Math.round(pendingAzn * 100) / 100,
      },
    };
  }

  async accrueCommissionsForSubscriptionInvoice(
    subscriptionInvoiceId: string,
    billingPeriod: string,
  ): Promise<void> {
    const { year, month } = parseBillingPeriod(billingPeriod);
    const items = await this.prisma.billingInvoiceItem.findMany({
      where: { subscriptionInvoiceId },
      select: {
        id: true,
        organizationId: true,
        amount: true,
      },
    });
    const now = new Date();
    for (const it of items) {
      const referral = await this.prisma.referral.findUnique({
        where: { organizationId: it.organizationId },
        include: { partner: true },
      });
      if (!referral?.isActive) continue;
      if (referral.windowEndsAt.getTime() < now.getTime()) continue;

      const referredCount = await this.prisma.referral.count({
        where: { partnerId: referral.partnerId },
      });
      const rate =
        referral.partner.fixedRatePercent != null
          ? Number(referral.partner.fixedRatePercent)
          : referralCommissionTierRate(referredCount);
      const amountNum = Number(it.amount) * (rate / 100);
      const amountAzn = new Prisma.Decimal(Math.round(amountNum * 10000) / 10000);

      await this.prisma.referralCommission.upsert({
        where: {
          referralId_periodYear_periodMonth: {
            referralId: referral.id,
            periodYear: year,
            periodMonth: month,
          },
        },
        create: {
          referralId: referral.id,
          subscriptionInvoiceId,
          amountAzn,
          ratePercent: new Prisma.Decimal(rate),
          periodYear: year,
          periodMonth: month,
          status: "ACCRUED",
        },
        update: {
          amountAzn,
          ratePercent: new Prisma.Decimal(rate),
          subscriptionInvoiceId,
        },
      });
    }
  }

  async deactivateExpiredReferrals(now = new Date()): Promise<number> {
    const res = await this.prisma.referral.updateMany({
      where: {
        isActive: true,
        windowEndsAt: { lt: now },
      },
      data: { isActive: false },
    });
    return res.count;
  }

  async listCommissionsForAdmin(partnerId?: string | null) {
    const raw = partnerId?.trim();
    return this.prisma.referralCommission.findMany({
      where: raw ? { referral: { partnerId: raw } } : {},
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      take: 1000,
      include: {
        referral: {
          select: {
            organizationId: true,
            partner: {
              select: { id: true, code: true, displayName: true },
            },
          },
        },
      },
    });
  }
}
