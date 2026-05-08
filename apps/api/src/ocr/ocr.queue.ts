import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { connectionFromRedisUrl } from "../queue/bullmq.config";

export const OCR_QUEUE = "ocr-invoices";
export type OcrJobPayload = { ocrJobId: string; organizationId: string };

@Injectable()
export class OcrQueueService implements OnModuleDestroy {
  private readonly queue: Queue<OcrJobPayload>;

  constructor(config: ConfigService) {
    this.queue = new Queue<OcrJobPayload>(OCR_QUEUE, {
      connection: connectionFromRedisUrl(config.get<string>("REDIS_URL", "redis://127.0.0.1:6379")),
    });
  }

  async enqueue(payload: OcrJobPayload): Promise<void> {
    await this.queue.add("recognize", payload, {
      attempts: 4,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 25,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
