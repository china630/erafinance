import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { connectionFromRedisUrl } from "../queue/bullmq.config";

export const MONTHLY_DEPRECIATION_QUEUE = "monthly-depreciation";

@Injectable()
export class MonthlyDepreciationQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MonthlyDepreciationQueueService.name);
  private readonly queue: Queue;

  constructor(config: ConfigService) {
    const connection = connectionFromRedisUrl(
      config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.queue = new Queue(MONTHLY_DEPRECIATION_QUEUE, { connection });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.FIXED_ASSETS_MONTHLY_DISABLED === "1") {
      this.logger.warn(
        "FIXED_ASSETS_MONTHLY_DISABLED=1 — monthly fixed-asset depreciation job disabled",
      );
      return;
    }
    await this.queue.add(
      "monthly_depreciation",
      {},
      {
        repeat: { pattern: "0 1 1 * *" },
        jobId: "fixed-assets-monthly-depreciation",
        removeOnComplete: true,
        removeOnFail: 12,
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
    this.logger.log(
      "BullMQ: monthly depreciation (1st of month 01:00 UTC, cron 0 1 1 * *)",
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
