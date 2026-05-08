import { Injectable, Logger } from "@nestjs/common";

/**
 * Logical tenant snapshot worker (R3.2–R3.3 backlog).
 * Baseline artifacts are written synchronously in {@link SnapshotService.takeSnapshot}.
 * Future: BullMQ consumer + read-replica `COPY … TO STDOUT` → tar.gz → optional KMS → S3 (see `tenant-tables.ts`).
 */
@Injectable()
export class LogicalTenantSnapshotWorker {
  private readonly logger = new Logger(LogicalTenantSnapshotWorker.name);

  /** Reserved for async full-table export; no-op until the queue consumer is wired. */
  async processSnapshotJob(params: { organizationId: string; snapshotId: string; reason: string }) {
    this.logger.debug(
      `Snapshot worker noop org=${params.organizationId} snapshot=${params.snapshotId} reason=${params.reason}`,
    );
  }
}
