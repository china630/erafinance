import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import archiver from "archiver";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import {
  STORAGE_SERVICE,
  type StorageService,
} from "../storage/storage.interface";
import type { AuditHubBulkExportDto } from "./dto/bulk-export.dto";

const MAX_FILES = 50;

function extFromMime(mime: string | null | undefined): string {
  if (!mime) return ".bin";
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  return ".bin";
}

@Injectable()
export class AuditBulkExportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async streamZip(
    organizationId: string,
    dto: AuditHubBulkExportDto,
    res: Response,
    opts?: { guest?: boolean },
  ): Promise<void> {
    const maxFiles = opts?.guest ? 20 : MAX_FILES;
    const sample = await this.prisma.auditSample.findFirst({
      where: { id: dto.sampleId, organizationId },
    });
    if (!sample) {
      throw new NotFoundException({ code: "SAMPLE_NOT_FOUND" });
    }

    const refs = sample.documentRefs as unknown;
    if (!Array.isArray(refs)) {
      throw new BadRequestException({ code: "INVALID_SAMPLE_REFS" });
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-sample-${sample.id}.zip"`,
    );
    archive.on("error", (err: Error) => {
      res.status(500).end(String(err.message));
    });
    archive.pipe(res);

    archive.append(
      JSON.stringify(
        {
          sampleId: sample.id,
          scope: sample.scope,
          mode: sample.mode,
          seed: sample.seed,
          createdAt: sample.createdAt.toISOString(),
          refs,
        },
        null,
        2,
      ),
      { name: "manifest.json" },
    );

    let n = 0;
    for (const ref of refs as Array<{ entityType?: string; entityId?: string }>) {
      if (n >= maxFiles) break;
      const entityType = ref.entityType;
      const entityId = ref.entityId;
      if (!entityType || !entityId) continue;

      if (entityType === "customs_declaration") {
        const row = await this.prisma.customsDeclaration.findFirst({
          where: { id: entityId, organizationId },
          select: { attachmentKey: true, id: true },
        });
        if (row?.attachmentKey) {
          const buf = await this.storage.getObject(row.attachmentKey);
          archive.append(buf, {
            name: `customs_${row.id}${extFromMime("application/pdf")}`,
          });
          n++;
        }
      } else if (entityType === "ocr_job") {
        const row = await this.prisma.ocrJob.findFirst({
          where: { id: entityId, organizationId },
          select: { fileKey: true, id: true, fileMime: true },
        });
        if (row?.fileKey) {
          const buf = await this.storage.getObject(row.fileKey);
          archive.append(buf, {
            name: `ocr_${row.id}${extFromMime(row.fileMime)}`,
          });
          n++;
        }
      } else if (entityType === "invoice" || entityType === "transaction") {
        archive.append(
          Buffer.from(JSON.stringify({ entityType, entityId }, null, 2), "utf8"),
          { name: `${entityType}_${entityId}.meta.json` },
        );
        n++;
      }
    }

    await archive.finalize();
  }
}
