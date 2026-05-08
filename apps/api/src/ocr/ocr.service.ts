import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_SERVICE, type StorageService } from "../storage/storage.interface";
import { OcrQueueService } from "./ocr.queue";
import { GeminiOcrProvider } from "./gemini-ocr.provider";
import { OpenAiOcrProvider } from "./openai-ocr.provider";
import type { OcrVisionProvider } from "./ocr-vision.interface";
import { QuotaService } from "../quota/quota.service";

@Injectable()
export class OcrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: OcrQueueService,
    private readonly config: ConfigService,
    private readonly openai: OpenAiOcrProvider,
    private readonly gemini: GeminiOcrProvider,
    private readonly quotas: QuotaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  pickProvider(): OcrVisionProvider {
    return this.config.get<string>("OCR_VISION_PROVIDER", "openai") === "gemini" ? this.gemini : this.openai;
  }

  async createJob(organizationId: string, file: Express.Multer.File, userId?: string) {
    await this.quotas.assertOcrJobsPerMonth(organizationId);
    const maxMb = Number(this.config.get<string>("OCR_MAX_FILE_MB", "10"));
    if (!file || !file.buffer?.length) throw new BadRequestException("File is required");
    if (file.buffer.length > maxMb * 1024 * 1024) throw new BadRequestException("File too large");
    const provider = this.pickProvider();
    const created = await this.prisma.$executeRawUnsafe(
      `INSERT INTO ocr_jobs (id, organization_id, status, provider, file_key, file_mime, attempt_count, triggered_by_user_id, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1::uuid, 'PENDING'::"OcrJobStatus", $2, '', $3, 0, $4::uuid, now(), now())`,
      organizationId,
      provider.name,
      file.mimetype,
      userId ?? null,
    );
    void created;
    const row = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM ocr_jobs WHERE organization_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
      organizationId,
    );
    const ocrJobId = row[0]?.id;
    const fileKey = `orgs/${organizationId}/ocr/${ocrJobId}.${(file.originalname.split(".").pop() || "bin").toLowerCase()}`;
    await this.storage.putObject(fileKey, file.buffer, { contentType: file.mimetype });
    await this.prisma.$executeRawUnsafe(
      `UPDATE ocr_jobs SET file_key = $2, updated_at = now() WHERE id = $1::uuid`,
      ocrJobId,
      fileKey,
    );
    await this.queue.enqueue({ ocrJobId, organizationId });
    return { id: ocrJobId, status: "PENDING" };
  }

  async getJob(organizationId: string, id: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, status, provider, result_json as "resultJson", error_json as "errorJson", updated_at as "updatedAt" FROM ocr_jobs WHERE id = $1::uuid AND organization_id = $2::uuid`,
      id,
      organizationId,
    );
    if (!rows[0]) throw new NotFoundException("OCR job not found");
    return rows[0];
  }
}
