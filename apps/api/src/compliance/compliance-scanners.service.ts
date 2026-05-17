import { Injectable } from "@nestjs/common";
import {
  CashOrderKind,
  CashOrderStatus,
  InvoiceStatus,
  Prisma,
  RiskAuditType,
  RiskSeverity,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  FRAUD_LARGE_CASH_WITHDRAWAL_AZN,
  FRAUD_MIN_PROFILE_PATCHES,
  FRAUD_SCAN_WINDOW_HOURS,
} from "./compliance.constants";

@Injectable()
export class CounterpartyVoenScanner {
  constructor(private readonly prisma: PrismaService) {}

  async scan(organizationId: string): Promise<
    Array<{
      dedupeKey: string;
      type: RiskAuditType;
      severity: RiskSeverity;
      description: string;
      metadata: Prisma.InputJsonValue;
    }>
  > {
    const out: Array<{
      dedupeKey: string;
      type: RiskAuditType;
      severity: RiskSeverity;
      description: string;
      metadata: Prisma.InputJsonValue;
    }> = [];

    const deletedWithLiveInvoices = await this.prisma.counterparty.findMany({
      where: {
        organizationId,
        deletedAt: { not: null },
        invoices: {
          some: { deletedAt: null, status: { not: InvoiceStatus.CANCELLED } },
        },
      },
      select: { id: true },
      take: 100,
    });

    for (const c of deletedWithLiveInvoices) {
      out.push({
        dedupeKey: `voen_deleted_with_invoices_${c.id}`,
        type: RiskAuditType.COMPLIANCE,
        severity: RiskSeverity.HIGH,
        description:
          "Counterparty is marked deleted but has active invoices — data integrity risk.",
        metadata: { counterpartyId: c.id, scanner: "CounterpartyVoenScanner" },
      });
    }

    return out;
  }
}

@Injectable()
export class FraudPatternsScanner {
  constructor(private readonly prisma: PrismaService) {}

  async scan(organizationId: string): Promise<
    | {
        dedupeKey: string;
        type: RiskAuditType;
        severity: RiskSeverity;
        description: string;
        metadata: Prisma.InputJsonValue;
      }
    | null
  > {
    const since = new Date(Date.now() - FRAUD_SCAN_WINDOW_HOURS * 3600 * 1000);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        createdAt: { gte: since },
        entityType: "HTTP_MUTATION",
        action: "PATCH",
      },
      select: { id: true, userId: true, changes: true },
    });

    const patchCountByUser = new Map<string, number>();
    for (const row of logs) {
      const ch = row.changes as { path?: string } | null;
      const path = typeof ch?.path === "string" ? ch.path : "";
      if (!path.toLowerCase().includes("/users/me")) continue;
      if (!row.userId) continue;
      patchCountByUser.set(row.userId, (patchCountByUser.get(row.userId) ?? 0) + 1);
    }

    for (const [userId, n] of patchCountByUser) {
      if (n < FRAUD_MIN_PROFILE_PATCHES) continue;

      const bigCash = await this.prisma.cashOrder.findFirst({
        where: {
          organizationId,
          status: CashOrderStatus.POSTED,
          kind: CashOrderKind.KXO,
          currency: "AZN",
          amount: { gte: FRAUD_LARGE_CASH_WITHDRAWAL_AZN },
          createdAt: { gte: since },
        },
        select: { id: true, amount: true, orderNumber: true },
      });

      if (!bigCash) continue;

      const dayBucket = new Date().toISOString().slice(0, 10);
      return {
        dedupeKey: `fraud_password_then_cash_${userId}_${dayBucket}`,
        type: RiskAuditType.FRAUD,
        severity: RiskSeverity.HIGH,
        description:
          "Rule-based signal: multiple profile PATCH events and a large posted cash withdrawal (KXO) in the same window.",
        metadata: {
          userId,
          profilePatchCount: n,
          cashOrderId: bigCash.id,
          cashOrderNumber: bigCash.orderNumber,
          cashAmount: bigCash.amount.toString(),
          scanner: "FraudPatternsScanner",
        },
      };
    }

    return null;
  }
}
