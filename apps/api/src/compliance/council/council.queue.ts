import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { connectionFromRedisUrl } from "../../queue/bullmq.config";
import type { CouncilDeliberationJobPayload } from "./council.types";

export const COUNCIL_ANALYSIS_QUEUE = "council-analysis";

@Injectable()
export class CouncilQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CouncilQueueService.name);
  private readonly queue: Queue<CouncilDeliberationJobPayload>;

  constructor(private readonly config: ConfigService) {
    this.queue = new Queue(COUNCIL_ANALYSIS_QUEUE, {
      connection: connectionFromRedisUrl(
        this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
      ),
    });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.COUNCIL_DELIBERATION_DISABLED === "1") {
      this.logger.warn(
        "COUNCIL_DELIBERATION_DISABLED=1 — council repeatable jobs not scheduled",
      );
      return;
    }
    await this.queue.add(
      "council_weekly_scan",
      { verdictId: "", organizationId: "" },
      {
        repeat: { pattern: "0 22 * * 0" },
        jobId: "council-weekly-scan",
        removeOnComplete: true,
        removeOnFail: 12,
      },
    );
    await this.queue.add(
      "council_pre_tax_scan",
      { verdictId: "", organizationId: "" },
      {
        repeat: { pattern: "0 22 15 * *" },
        jobId: "council-pre-tax-scan",
        removeOnComplete: true,
        removeOnFail: 12,
      },
    );
    this.logger.log(
      "BullMQ: council-analysis (weekly Sun 22:00 UTC, pre-tax 15th 22:00 UTC)",
    );
  }

  async enqueue(
    payload: CouncilDeliberationJobPayload,
    jobId: string,
  ): Promise<void> {
    await this.queue.add("council_deliberate", payload, {
      jobId,
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: 25,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
