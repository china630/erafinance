import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { connectionFromRedisUrl } from "../queue/bullmq.config";

export const COMPLIANCE_RISK_QUEUE = "compliance-risk-scan";

@Injectable()
export class ComplianceRiskQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComplianceRiskQueueService.name);
  private readonly queue: Queue;

  constructor(private readonly config: ConfigService) {
    const connection = connectionFromRedisUrl(
      this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.queue = new Queue(COMPLIANCE_RISK_QUEUE, { connection });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.COMPLIANCE_RISK_SCAN_DISABLED === "1") {
      this.logger.warn(
        "COMPLIANCE_RISK_SCAN_DISABLED=1 — compliance risk scan queue not scheduled",
      );
      return;
    }
    await this.queue.add(
      "compliance_risk_daily",
      {},
      {
        repeat: { pattern: "0 2 * * *" },
        jobId: "compliance-risk-scan-daily",
        removeOnComplete: true,
        removeOnFail: 12,
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
    await this.queue.add(
      "check-tax-limits",
      {},
      {
        repeat: { pattern: "0 3 * * *" },
        jobId: "check-tax-limits-daily",
        removeOnComplete: true,
        removeOnFail: 12,
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
    this.logger.log(
      "BullMQ: compliance risk scan (daily 02:00 UTC) + check-tax-limits (03:00 UTC)",
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
