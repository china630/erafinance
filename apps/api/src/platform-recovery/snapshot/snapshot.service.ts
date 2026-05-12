import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_SERVICE, type StorageService } from "../../storage/storage.interface";

type SnapshotArtifactV1 = {
  format: "erafinance-tenant-snapshot-v1";
  snapshotId: string;
  organizationId: string;
  reason: string;
  takenAt: string;
  /** Full logical COPY (see `tenant-tables.ts`) is a separate worker backlog; this artifact is the durable baseline blob. */
  pipeline: "metadata_json_v1";
};

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /**
   * Persists snapshot metadata and uploads a versioned JSON artifact to object storage (S3 or local driver).
   * Logical per-table COPY is tracked separately (`LogicalTenantSnapshotWorker` / `tenant-tables.ts`).
   */
  async takeSnapshot(
    organizationId: string,
    reason: string,
    triggeredByUserId: string | null,
  ): Promise<{ id: string }> {
    const snapshotId = randomUUID();
    const s3Key = `snapshots/${organizationId}/${snapshotId}.json`;
    const takenAt = new Date().toISOString();
    const payload: SnapshotArtifactV1 = {
      format: "erafinance-tenant-snapshot-v1",
      snapshotId,
      organizationId,
      reason,
      takenAt,
      pipeline: "metadata_json_v1",
    };
    const body = Buffer.from(JSON.stringify(payload, null, 0), "utf8");
    const sha256 = createHash("sha256").update(body).digest("hex");

    await this.storage.putObject(s3Key, body, { contentType: "application/json" });

    const retentionDays = Math.max(
      1,
      Math.min(
        3650,
        Number(this.config.get<string>("SNAPSHOT_RETENTION_DAYS") ?? "30") || 30,
      ),
    );
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);

    const row = await this.prisma.organizationDataSnapshot.create({
      data: {
        id: snapshotId,
        organizationId,
        reason,
        s3Key,
        sha256,
        sizeBytes: BigInt(body.length),
        expiresAt,
        triggeredByUserId,
      },
      select: { id: true },
    });
    this.logger.log(`Snapshot stored id=${row.id} org=${organizationId} reason=${reason} key=${s3Key}`);
    return row;
  }

  async listSnapshots(organizationId: string) {
    return this.prisma.organizationDataSnapshot.findMany({
      where: { organizationId },
      orderBy: { takenAt: "desc" },
      take: 50,
    });
  }
}
