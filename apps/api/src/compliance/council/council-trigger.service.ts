import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CouncilDispatcherService } from "./council-dispatcher.service";
import { COUNCIL_LARGE_TRANSACTION_AZN_DEFAULT } from "./council.constants";
import type { CouncilTriggerSource } from "./council.types";

@Injectable()
export class CouncilTriggerService {
  private readonly logger = new Logger(CouncilTriggerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dispatcher: CouncilDispatcherService,
  ) {}

  largeTransactionThresholdAzn(): number {
    const raw = this.config.get<string>("COUNCIL_LARGE_TRANSACTION_AZN");
    const n = raw ? Number(raw) : COUNCIL_LARGE_TRANSACTION_AZN_DEFAULT;
    return Number.isFinite(n) && n > 0 ? n : COUNCIL_LARGE_TRANSACTION_AZN_DEFAULT;
  }

  async maybeTriggerHighValueTransaction(params: {
    organizationId: string;
    entityType: "INVOICE" | "CASH_ORDER";
    entityId: string;
    label: string;
    amountAzn: number;
    currency: string;
  }): Promise<void> {
    if (params.currency !== "AZN") return;
    if (params.amountAzn < this.largeTransactionThresholdAzn()) return;

    const dedupeKey = `high_value_${params.entityType}_${params.entityId}`;
    try {
      await this.dispatcher.deliberate({
        organizationId: params.organizationId,
        triggerSource: "HIGH_VALUE_TRANSACTION" satisfies CouncilTriggerSource,
        target: {
          entityType: params.entityType,
          entityId: params.entityId,
          label: params.label,
        },
        dedupeKey,
      });
    } catch (e) {
      this.logger.warn(
        `Council high-value trigger skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async triggerTaxLimitHit(params: {
    organizationId: string;
    riskAuditId: string;
    year: number;
    band: "yellow" | "red";
  }): Promise<void> {
    const dedupeKey = `tax_limit_council_${params.year}_${params.band}`;
    try {
      await this.dispatcher.deliberate({
        organizationId: params.organizationId,
        triggerSource: "TAX_LIMIT_HIT",
        target: {
          entityType: "ORGANIZATION",
          entityId: params.organizationId,
          label: `VAT threshold:${params.year}:${params.band}`,
        },
        riskAuditId: params.riskAuditId,
        dedupeKey,
      });
    } catch (e) {
      this.logger.warn(
        `Council tax-limit trigger skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
