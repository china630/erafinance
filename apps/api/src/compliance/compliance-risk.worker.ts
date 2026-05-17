import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Worker } from "bullmq";
import { BillingStatus } from "@erafinance/database";
import { attachWorkerFailureAlert } from "../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { COMPLIANCE_RISK_QUEUE } from "./compliance-risk.queue";
import { ComplianceService } from "./compliance.service";

@Injectable()
export class ComplianceRiskWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComplianceRiskWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly access: SubscriptionAccessService,
    private readonly compliance: ComplianceService,
  ) {}

  onModuleInit(): void {
    if (process.env.COMPLIANCE_RISK_SCAN_DISABLED === "1") {
      this.logger.warn(
        "COMPLIANCE_RISK_SCAN_DISABLED=1 — compliance risk worker not started",
      );
      return;
    }
    const connection = connectionFromRedisUrl(
      this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.worker = new Worker(
      COMPLIANCE_RISK_QUEUE,
      async (job: Job) => this.handle(job),
      { connection },
    );
    attachWorkerFailureAlert(
      this.worker,
      COMPLIANCE_RISK_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ??
        undefined,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job): Promise<void> {
    if (job.name === "compliance_risk_daily") {
      const orgs = await this.prisma.organization.findMany({
        where: { isDeleted: false, deletedAt: null },
        select: { id: true },
      });

      for (const { id } of orgs) {
        try {
          const allowed = await this.access.hasModule(
            id,
            ModuleEntitlement.COMPLIANCE_PRO,
          );
          if (!allowed) continue;
          await this.compliance.runScansForOrganization(id);
        } catch (e) {
          this.logger.warn(
            `compliance scan failed for org ${id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      return;
    }

    if (job.name === "check-tax-limits") {
      const orgs = await this.prisma.organization.findMany({
        where: {
          isDeleted: false,
          deletedAt: null,
          billingStatus: BillingStatus.ACTIVE,
        },
        select: { id: true },
      });
      for (const { id } of orgs) {
        try {
          await this.compliance.runTaxLimitScanForOrganization(id);
        } catch (e) {
          this.logger.warn(
            `check-tax-limits failed for org ${id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }
  }
}
