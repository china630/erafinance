import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationSeverity,
  Prisma,
  RiskSeverity,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import { NotificationService } from "../notifications/notification.service";
import {
  VAT_REGISTRATION_THRESHOLD_AZN,
  VAT_TURNOVER_CRITICAL_AZN,
  VAT_TURNOVER_WARN_AZN,
} from "./compliance.constants";
import {
  CounterpartyVoenScanner,
  FraudPatternsScanner,
} from "./compliance-scanners.service";
import {
  TaxLimitService,
  type VatThresholdMonitorSnapshot,
} from "./tax-limit.service";
import { CouncilTriggerService } from "./council/council-trigger.service";

export type RiskPosture = "green" | "yellow" | "red";

export type RiskAuditUpsertOutcome =
  | { kind: "skipped_non_pending" }
  | { kind: "created" }
  | { kind: "updated"; severityChanged: boolean };

export type RiskScanRow = {
  dedupeKey: string;
  type: import("@erafinance/database").RiskAuditType;
  severity: RiskSeverity;
  description: string;
  metadata: Prisma.InputJsonValue;
};

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxLimits: TaxLimitService,
    private readonly voenScanner: CounterpartyVoenScanner,
    private readonly fraudScanner: FraudPatternsScanner,
    private readonly notifications: NotificationService,
    private readonly councilTriggers: CouncilTriggerService,
  ) {}

  /** Compliance Pro scanners (VÖEN + fraud). VAT threshold runs via `runTaxLimitScanForOrganization` (all ACTIVE orgs). */
  async runScansForOrganization(organizationId: string): Promise<void> {
    const voenRows = await this.voenScanner.scan(organizationId);
    for (const row of voenRows) {
      await this.upsertAlertFromScan(organizationId, row);
    }

    const fraud = await this.fraudScanner.scan(organizationId);
    if (fraud) {
      await this.upsertAlertFromScan(organizationId, fraud);
    }
  }

  async runTaxLimitScanForOrganization(organizationId: string): Promise<void> {
    const row = await this.taxLimits.buildRiskAuditCandidate(organizationId);
    if (!row) {
      return;
    }
    const outcome = await this.upsertAlertFromScan(organizationId, row);
    const shouldNotify =
      outcome.kind === "created" ||
      (outcome.kind === "updated" && outcome.severityChanged);

    if (shouldNotify) {
      const audit = await this.prisma.riskAudit.findUnique({
        where: {
          organizationId_dedupeKey: {
            organizationId,
            dedupeKey: row.dedupeKey,
          },
        },
        select: { id: true },
      });
      if (audit) {
        const monitor = await this.taxLimits.getVatThresholdMonitorSnapshot(
          organizationId,
        );
        const band =
          monitor.turnoverAzn > VAT_TURNOVER_CRITICAL_AZN ? "red" : "yellow";
        void this.councilTriggers.triggerTaxLimitHit({
          organizationId,
          riskAuditId: audit.id,
          year: monitor.year,
          band,
        });
      }
    }

    if (!shouldNotify) {
      return;
    }

    const sev =
      row.severity === RiskSeverity.HIGH
        ? NotificationSeverity.CRITICAL
        : NotificationSeverity.WARNING;
    const title =
      row.severity === RiskSeverity.HIGH
        ? "VAT turnover alert: critical band (95%+)"
        : "VAT turnover alert: warning band (80%+)";
    const message =
      row.severity === RiskSeverity.HIGH
        ? `YTD revenue (AZN) toward the ${VAT_REGISTRATION_THRESHOLD_AZN.toLocaleString("en-US")} AZN VAT registration reference has crossed the ${VAT_TURNOVER_CRITICAL_AZN.toLocaleString("en-US")} AZN (95%) threshold. See Risk & Compliance for details.`
        : `YTD revenue (AZN) toward the ${VAT_REGISTRATION_THRESHOLD_AZN.toLocaleString("en-US")} AZN VAT registration reference has crossed the ${VAT_TURNOVER_WARN_AZN.toLocaleString("en-US")} AZN (80%) threshold. See Risk & Compliance for details.`;

    await this.notifications.notifyFinanceUsers(organizationId, {
      title,
      message,
      severity: sev,
      link: "/compliance",
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: null,
        entityType: "compliance.tax_limit_monitor",
        entityId: `${organizationId}:${row.dedupeKey}`,
        action: "THRESHOLD_HIT",
        newValues: {
          dedupeKey: row.dedupeKey,
          severity: row.severity,
          description: row.description,
          notifiedAt: new Date().toISOString(),
        },
      },
    });
  }

  async upsertAlertFromScan(
    organizationId: string,
    row: RiskScanRow,
  ): Promise<RiskAuditUpsertOutcome> {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.riskAudit.findUnique({
        where: {
          organizationId_dedupeKey: {
            organizationId,
            dedupeKey: row.dedupeKey,
          },
        },
      });

      if (existing && existing.status !== "PENDING") {
        return { kind: "skipped_non_pending" };
      }

      if (existing) {
        const severityChanged = existing.severity !== row.severity;
        await tx.riskAudit.update({
          where: { id: existing.id },
          data: {
            severity: row.severity,
            description: row.description,
            metadata: row.metadata as Prisma.InputJsonValue,
          },
        });
        return { kind: "updated", severityChanged };
      }

      await tx.riskAudit.create({
        data: {
          organizationId,
          dedupeKey: row.dedupeKey,
          type: row.type,
          severity: row.severity,
          status: "PENDING",
          description: row.description,
          metadata: row.metadata as Prisma.InputJsonValue,
        },
      });
      return { kind: "created" };
    });
  }

  getVatThresholdMonitorSnapshot(
    organizationId: string,
  ): Promise<VatThresholdMonitorSnapshot> {
    return this.taxLimits.getVatThresholdMonitorSnapshot(organizationId);
  }

  async listRiskAudits(
    organizationId: string,
    q: {
      status?: import("@erafinance/database").RiskAuditStatus;
      type?: import("@erafinance/database").RiskAuditType;
      page?: number;
      pageSize?: number;
    },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      q.page,
      q.pageSize,
      25,
    );
    const where: Prisma.RiskAuditWhereInput = { organizationId };
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.riskAudit.findMany({
        where,
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      this.prisma.riskAudit.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getRiskSummary(organizationId: string): Promise<{
    posture: RiskPosture;
    pending: { high: number; medium: number; low: number; total: number };
  }> {
    const pending = await this.prisma.riskAudit.groupBy({
      by: ["severity"],
      where: { organizationId, status: "PENDING" },
      _count: { id: true },
    });

    let high = 0;
    let medium = 0;
    let low = 0;
    for (const g of pending) {
      if (g.severity === RiskSeverity.HIGH) high = g._count.id;
      if (g.severity === RiskSeverity.MEDIUM) medium = g._count.id;
      if (g.severity === RiskSeverity.LOW) low = g._count.id;
    }
    const total = high + medium + low;

    let posture: RiskPosture = "green";
    if (high > 0) posture = "red";
    else if (medium > 0) posture = "yellow";
    else if (low > 0) posture = "yellow";

    return { posture, pending: { high, medium, low, total } };
  }

  async updateRiskAuditStatus(
    organizationId: string,
    id: string,
    body: {
      status: "MITIGATED" | "IGNORED";
      mitigationNote?: string;
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.riskAudit.findFirst({
        where: { id, organizationId },
      });
      if (!row) {
        throw new NotFoundException("Risk audit not found");
      }
      if (row.status !== "PENDING") {
        throw new BadRequestException(
          "Only PENDING alerts can be mitigated or ignored.",
        );
      }
      await tx.riskAudit.update({
        where: { id },
        data: {
          status: body.status,
          mitigationNote: body.mitigationNote?.trim() || null,
        },
      });
    });
  }
}
