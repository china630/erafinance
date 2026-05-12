import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Worker } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_SERVICE, type StorageService } from "../storage/storage.interface";
import { OCR_QUEUE, type OcrJobPayload } from "./ocr.queue";
import { attachWorkerFailureAlert } from "../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { OcrService } from "./ocr.service";

@Injectable()
export class OcrWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OcrWorker.name);
  private worker?: Worker<OcrJobPayload>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ocr: OcrService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<OcrJobPayload>(
      OCR_QUEUE,
      async (job: Job<OcrJobPayload>) => this.handle(job),
      { connection: connectionFromRedisUrl(this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379")) },
    );
    attachWorkerFailureAlert(
      this.worker,
      OCR_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ?? undefined,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job<OcrJobPayload>) {
    const { ocrJobId, organizationId } = job.data;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ file_key: string; file_mime: string; attempt_count: number }>>(
      `SELECT file_key, file_mime, attempt_count FROM ocr_jobs WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      ocrJobId,
      organizationId,
    );
    const row = rows[0];
    if (!row) return;
    await this.prisma.$executeRawUnsafe(`UPDATE ocr_jobs SET status='RUNNING'::"OcrJobStatus", updated_at=now() WHERE id=$1::uuid`, ocrJobId);
    try {
      const bytes = await this.storage.getObject(row.file_key);
      const result = await this.ocr.pickProvider().recognizeForeignInvoice({
        fileBytes: bytes,
        fileName: row.file_key,
        mimeType: row.file_mime,
      });
      await this.prisma.$executeRawUnsafe(
        `UPDATE ocr_jobs SET status='DONE'::"OcrJobStatus", result_json=$2::jsonb, attempt_count=$3, updated_at=now() WHERE id=$1::uuid`,
        ocrJobId,
        JSON.stringify(result),
        Number(row.attempt_count ?? 0) + 1,
      );
    } catch (error) {
      this.logger.error(`OCR failed for ${ocrJobId}: ${error instanceof Error ? error.message : String(error)}`);
      await this.prisma.$executeRawUnsafe(
        `UPDATE ocr_jobs SET status='ERROR'::"OcrJobStatus", error_json=$2::jsonb, attempt_count=$3, updated_at=now() WHERE id=$1::uuid`,
        ocrJobId,
        JSON.stringify({ message: error instanceof Error ? error.message : String(error) }),
        Number(row.attempt_count ?? 0) + 1,
      );
      throw error;
    }
  }
}
