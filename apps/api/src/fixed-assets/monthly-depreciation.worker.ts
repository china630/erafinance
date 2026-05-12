import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Worker } from "bullmq";
import { attachWorkerFailureAlert } from "../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { PrismaService } from "../prisma/prisma.service";
import { FixedAssetsService } from "./fixed-assets.service";
import { MONTHLY_DEPRECIATION_QUEUE } from "./monthly-depreciation.queue";

function utcPreviousMonth(now: Date): { year: number; month: number } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

@Injectable()
export class MonthlyDepreciationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonthlyDepreciationWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly fixedAssets: FixedAssetsService,
  ) {}

  onModuleInit(): void {
    if (process.env.FIXED_ASSETS_MONTHLY_DISABLED === "1") {
      this.logger.warn(
        "FIXED_ASSETS_MONTHLY_DISABLED=1 — monthly depreciation worker not started",
      );
      return;
    }
    const connection = connectionFromRedisUrl(
      this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.worker = new Worker(
      MONTHLY_DEPRECIATION_QUEUE,
      async (job: Job) => this.handle(job),
      { connection },
    );
    attachWorkerFailureAlert(
      this.worker,
      MONTHLY_DEPRECIATION_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ?? undefined,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job): Promise<void> {
    if (job.name !== "monthly_depreciation") {
      return;
    }
    const period = utcPreviousMonth(new Date());
    const orgs = await this.prisma.organization.findMany({
      where: { deletedAt: null, isDeleted: false },
      select: { id: true },
    });
    for (const org of orgs) {
      try {
        await runWithTenantContextAsync(
          { organizationId: org.id, skipTenantFilter: false },
          async () => {
            await this.fixedAssets.runMonthlyDepreciation(org.id, period);
          },
        );
      } catch (e) {
        this.logger.error(
          `Monthly depreciation failed for org ${org.id}: ${String(e)}`,
        );
      }
    }
  }
}
