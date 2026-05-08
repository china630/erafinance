import {
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { runWithRecoveryContextAsync } from "../../prisma/recovery-context";

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Diff counts vs current DB — full TEMP-schema compare in R4. */
  async previewRestore(organizationId: string, snapshotId: string) {
    const snap = await this.prisma.organizationDataSnapshot.findFirst({
      where: { id: snapshotId, organizationId },
    });
    if (!snap) {
      return { ok: false, error: "snapshot_not_found" as const };
    }
    const [invoices, employees, counterparties] = await Promise.all([
      this.prisma.invoice.count({ where: { organizationId } }),
      this.prisma.employee.count({ where: { organizationId } }),
      this.prisma.counterparty.count({ where: { organizationId } }),
    ]);
    return {
      ok: true,
      snapshotId,
      sha256: snap.sha256,
      tables: {
        invoices: { current: invoices, snapshotPlaceholder: "unknown_until_etl" },
        employees: { current: employees, snapshotPlaceholder: "unknown_until_etl" },
        counterparties: { current: counterparties, snapshotPlaceholder: "unknown_until_etl" },
      },
    };
  }

  async restoreFromSnapshot(
    organizationId: string,
    snapshotId: string,
    _requesterId: string,
  ): Promise<{ rollbackRecordId: string }> {
    return runWithRecoveryContextAsync(
      { includeSoftDeleted: true, bypassTenantFilter: true },
      async () => {
        const snap = await this.prisma.organizationDataSnapshot.findFirst({
          where: { id: snapshotId, organizationId },
        });
        if (!snap) {
          throw new NotFoundException("Snapshot not found");
        }
        const rec = await this.prisma.tenantRollbackRecord.create({
          data: {
            organizationId,
            snapshotId,
            status: "PENDING",
            progressJson: { phase: "queued" },
          },
        });
        this.logger.warn(
          `restoreFromSnapshot queued record=${rec.id} — full ETL swap not implemented in this build`,
        );
        return { rollbackRecordId: rec.id };
      },
    );
  }

  /**
   * R5.2: nearest snapshot ≤ T + forward replay of AuditLog to T in TEMP schema — not fully implemented.
   * Returns guidance when a baseline snapshot exists.
   */
  async restoreToPointInTime(
    organizationId: string,
    _snapshotId: string,
    targetTimeIso: string,
  ): Promise<never> {
    const T = new Date(targetTimeIso);
    if (Number.isNaN(T.getTime())) {
      throw new NotFoundException("Invalid target time");
    }
    const snap = await this.prisma.organizationDataSnapshot.findFirst({
      where: { organizationId, takenAt: { lte: T } },
      orderBy: { takenAt: "desc" },
    });
    if (!snap) {
      throw new NotFoundException("No organization snapshot at or before target time");
    }
    throw new NotImplementedException(
      `R5.2: nearest snapshot=${snap.id} @ ${snap.takenAt.toISOString()}; forward AuditLog replay to ${targetTimeIso} not implemented — use restoreFromSnapshot for baseline-only MVP.`,
    );
  }
}
