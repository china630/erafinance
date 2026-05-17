import { Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TaxLimitService } from "../tax-limit.service";
import { anonymizeCouncilPayload } from "./council-pii.util";
import type {
  CouncilSnapshot,
  CouncilTargetRef,
  CouncilTriggerSource,
} from "./council.types";

@Injectable()
export class CouncilSnapshotBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxLimits: TaxLimitService,
  ) {}

  async buildSnapshot(
    organizationId: string,
    triggerSource: CouncilTriggerSource,
    target: CouncilTargetRef,
    riskAuditId?: string | null,
  ): Promise<CouncilSnapshot> {
    const year = new Date().getUTCFullYear();
    const turnover = await this.taxLimits.getCurrentYearTurnover(organizationId);
    const vatMonitor = await this.taxLimits.getVatThresholdMonitorSnapshot(
      organizationId,
    );

    const context: Record<string, unknown> = {
      triggerSource,
      target,
      ytdTurnoverAzn: turnover,
      vatThresholdMonitor: vatMonitor,
    };

    if (riskAuditId) {
      const audit = await this.prisma.riskAudit.findFirst({
        where: { id: riskAuditId, organizationId },
      });
      if (!audit) {
        throw new NotFoundException("Risk audit not found");
      }
      context.riskAudit = {
        type: audit.type,
        severity: audit.severity,
        status: audit.status,
        description: audit.description,
        metadata: audit.metadata,
        dedupeKey: audit.dedupeKey,
      };
    }

    if (target.entityType === "INVOICE" && target.entityId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: target.entityId, organizationId, deletedAt: null },
        select: {
          number: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          currency: true,
          createdAt: true,
          counterpartyId: true,
        },
      });
      if (inv) {
        context.invoice = inv;
      }
    }

    if (target.entityType === "CASH_ORDER" && target.entityId) {
      const co = await this.prisma.cashOrder.findFirst({
        where: { id: target.entityId, organizationId },
        select: {
          orderNumber: true,
          kind: true,
          status: true,
          amount: true,
          currency: true,
          date: true,
        },
      });
      if (co) {
        context.cashOrder = co;
      }
    }

    if (target.entityType === "LEDGER_PERIOD" || triggerSource === "WEEKLY_CRON") {
      const since = new Date(Date.UTC(year, 0, 1));
      const invAgg = await this.prisma.invoice.aggregate({
        where: {
          organizationId,
          deletedAt: null,
          currency: "AZN",
          status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
          createdAt: { gte: since },
        },
        _count: { id: true },
        _sum: { totalAmount: true },
      });
      context.periodStats = {
        invoiceCount: invAgg._count.id,
        invoiceTotalAzn: Number(invAgg._sum.totalAmount ?? 0),
      };
    }

    const anonymized = anonymizeCouncilPayload(context) as Record<string, unknown>;

    return {
      organizationToken: `ORG_${organizationId.slice(0, 8)}`,
      triggerSource,
      target,
      fiscalYear: year,
      context: anonymized,
    };
  }
}
