import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BillingStatus } from "@erafinance/database";
import { Job, Worker } from "bullmq";
import { attachWorkerFailureAlert } from "../../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../../queue/bullmq.config";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionAccessService } from "../../subscription/subscription-access.service";
import { ModuleEntitlement } from "../../subscription/subscription.constants";
import { CouncilEngineService } from "./council-engine.service";
import { CouncilDispatcherService } from "./council-dispatcher.service";
import { COUNCIL_ANALYSIS_QUEUE } from "./council.queue";
import type { CouncilDeliberationJobPayload } from "./council.types";

@Injectable()
export class CouncilWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CouncilWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly engine: CouncilEngineService,
    private readonly dispatcher: CouncilDispatcherService,
    private readonly access: SubscriptionAccessService,
  ) {}

  onModuleInit(): void {
    if (process.env.COUNCIL_DELIBERATION_DISABLED === "1") {
      this.logger.warn("COUNCIL_DELIBERATION_DISABLED=1 — council worker not started");
      return;
    }
    const connection = connectionFromRedisUrl(
      this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.worker = new Worker(
      COUNCIL_ANALYSIS_QUEUE,
      async (job: Job) => this.handle(job),
      { connection },
    );
    attachWorkerFailureAlert(
      this.worker,
      COUNCIL_ANALYSIS_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ?? undefined,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job): Promise<void> {
    if (job.name === "council_deliberate") {
      const data = job.data as CouncilDeliberationJobPayload;
      if (!data.verdictId || !data.organizationId) return;
      await this.engine.runDeliberation(data);
      return;
    }

    if (job.name === "council_weekly_scan") {
      await this.runBatchDeliberation("WEEKLY_CRON", "LEDGER_PERIOD");
      return;
    }

    if (job.name === "council_pre_tax_scan") {
      await this.runBatchDeliberation("PRE_TAX_CRON", "LEDGER_PERIOD");
    }
  }

  private async runBatchDeliberation(
    trigger: "WEEKLY_CRON" | "PRE_TAX_CRON",
    entityType: "LEDGER_PERIOD",
  ): Promise<void> {
    const orgs = await this.prisma.organization.findMany({
      where: {
        isDeleted: false,
        deletedAt: null,
        billingStatus: BillingStatus.ACTIVE,
      },
      select: { id: true },
    });

    const week = new Date().toISOString().slice(0, 10);
    const dedupeSuffix =
      trigger === "WEEKLY_CRON"
        ? `weekly_${week.slice(0, 7)}`
        : `pre_tax_${week.slice(0, 7)}`;

    for (const { id: organizationId } of orgs) {
      try {
        const allowed = await this.access.hasModule(
          organizationId,
          ModuleEntitlement.COMPLIANCE_PRO,
        );
        if (!allowed) continue;

        await this.dispatcher.deliberate({
          organizationId,
          triggerSource: trigger,
          target: {
            entityType,
            entityId: null,
            label: `Period:${week}`,
          },
          dedupeKey: `${dedupeSuffix}_${organizationId}`,
        });
      } catch (e) {
        this.logger.warn(
          `Council batch ${trigger} failed for org ${organizationId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
}
