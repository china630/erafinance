import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { REFERRAL_MONTHLY_QUEUE } from "./referrals.constants";

@Injectable()
export class ReferralMonthlyQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReferralMonthlyQueueService.name);
  private readonly queue: Queue;

  constructor(config: ConfigService) {
    const connection = connectionFromRedisUrl(
      config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.queue = new Queue(REFERRAL_MONTHLY_QUEUE, { connection });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.REFERRAL_MONTHLY_DISABLED === "1") {
      this.logger.warn("REFERRAL_MONTHLY_DISABLED=1 — referral monthly job disabled");
      return;
    }
    await this.queue.add(
      "referral_monthly_expire",
      {},
      {
        repeat: { pattern: "0 5 1 * *" },
        jobId: "referral-monthly-expire",
        removeOnComplete: true,
        removeOnFail: 12,
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
    this.logger.log(
      "BullMQ: referral window expiry (1st of month 05:00 UTC, cron 0 5 1 * *)",
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
