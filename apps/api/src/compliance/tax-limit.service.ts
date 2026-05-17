import { Injectable } from "@nestjs/common";
import {
  BankStatementChannel,
  BankStatementLineOrigin,
  BankStatementLineType,
  CashOrderKind,
  CashOrderStatus,
  Prisma,
  RiskAuditType,
  RiskSeverity,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  VAT_REGISTRATION_THRESHOLD_AZN,
  VAT_TURNOVER_CRITICAL_AZN,
  VAT_TURNOVER_WARN_AZN,
} from "./compliance.constants";

/** Asia/Baku is UTC+4 (no DST). */
export const BAKU_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;

export type TaxLimitRiskScanRow = {
  dedupeKey: string;
  type: RiskAuditType;
  severity: RiskSeverity;
  description: string;
  metadata: Prisma.InputJsonValue;
};

export type VatThresholdMonitorSnapshot = {
  /** Calendar year in Asia/Baku. */
  year: number;
  turnoverAzn: number;
  /** Linked invoice payments (cash KMO + confirmed bank inflows). */
  linkedPaymentsAzn: number;
  /** Standalone business receipts (unlinked cash + bank). */
  unlinkedPaymentsAzn: number;
  /** @deprecated Use linkedPaymentsAzn */
  invoiceTotalAzn: number;
  /** @deprecated Use unlinkedPaymentsAzn */
  cashStandaloneAzn: number;
  thresholdAzn: number;
  warnAtAzn: number;
  criticalAtAzn: number;
  ratio: number;
  progressPct: number;
  band: "green" | "yellow" | "red";
};

export type TurnoverBreakdown = {
  year: number;
  totalAzn: number;
  linkedPaymentsAzn: number;
  unlinkedPaymentsAzn: number;
  linkedCashAzn: number;
  linkedBankAzn: number;
  unlinkedCashAzn: number;
  unlinkedBankAzn: number;
};

@Injectable()
export class TaxLimitService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calendar year as seen in Asia/Baku at `ref`. */
  getBakuCalendarYear(ref: Date = new Date()): number {
    return new Date(ref.getTime() + BAKU_UTC_OFFSET_MS).getUTCFullYear();
  }

  /**
   * Inclusive UTC instant range for a Baku calendar year (Jan 1 00:00 Baku … Dec 31 23:59:59.999 Baku).
   * start = Date.UTC(year, 0, 1) − 4h; end = Date.UTC(year + 1, 0, 1) − 4h − 1ms.
   */
  getBakuCalendarYearBoundsUtc(year: number): { start: Date; end: Date } {
    return {
      start: new Date(Date.UTC(year, 0, 1) - BAKU_UTC_OFFSET_MS),
      end: new Date(Date.UTC(year + 1, 0, 1) - BAKU_UTC_OFFSET_MS - 1),
    };
  }

  /** @deprecated Use getBakuCalendarYearBoundsUtc */
  getCalendarYearBoundsUtc(year: number): { start: Date; end: Date } {
    return this.getBakuCalendarYearBoundsUtc(year);
  }

  /** Inclusive date range for @db.Date columns (Baku calendar year). */
  private getBakuCalendarYearDateRange(year: number): { gte: Date; lte: Date } {
    return {
      gte: new Date(Date.UTC(year, 0, 1)),
      lte: new Date(Date.UTC(year, 11, 31)),
    };
  }

  private bankLineDateWhere(year: number): Prisma.BankStatementLineWhereInput {
    const { gte, lte } = this.getBakuCalendarYearDateRange(year);
    return {
      OR: [
        { valueDate: { gte, lte } },
        {
          valueDate: null,
          bankStatement: { date: { gte, lte } },
        },
      ],
    };
  }

  /**
   * YTD revenue (cash method): posted linked/unlinked KMO + confirmed bank INFLOWs in AZN
   * for the Baku calendar year (partial invoice payments included via linked payment rows).
   */
  async getCurrentYearTurnover(
    organizationId: string,
    ref: Date = new Date(),
  ): Promise<TurnoverBreakdown> {
    const year = this.getBakuCalendarYear(ref);
    const { gte: dateGte, lte: dateLte } = this.getBakuCalendarYearDateRange(year);
    const bankDateWhere = this.bankLineDateWhere(year);

    const [linkedCash, linkedBank, unlinkedCash, unlinkedBank] =
      await Promise.all([
        this.prisma.cashOrder.aggregate({
          where: {
            organizationId,
            kind: CashOrderKind.KMO,
            status: CashOrderStatus.POSTED,
            currency: "AZN",
            date: { gte: dateGte, lte: dateLte },
            sourceInvoiceId: { not: null },
          },
          _sum: { amount: true },
        }),
        this.prisma.bankStatementLine.aggregate({
          where: {
            organizationId,
            type: BankStatementLineType.INFLOW,
            isMatched: true,
            matchedInvoiceId: { not: null },
            ...bankDateWhere,
            NOT: {
              AND: [
                { origin: BankStatementLineOrigin.INVOICE_PAYMENT_SYSTEM },
                {
                  bankStatement: {
                    is: { channel: BankStatementChannel.CASH },
                  },
                },
              ],
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.cashOrder.aggregate({
          where: {
            organizationId,
            kind: CashOrderKind.KMO,
            status: CashOrderStatus.POSTED,
            currency: "AZN",
            date: { gte: dateGte, lte: dateLte },
            sourceInvoiceId: null,
            sourceInvoicePaymentId: null,
          },
          _sum: { amount: true },
        }),
        this.prisma.bankStatementLine.aggregate({
          where: {
            organizationId,
            type: BankStatementLineType.INFLOW,
            matchedInvoiceId: null,
            ...bankDateWhere,
          },
          _sum: { amount: true },
        }),
      ]);

    const linkedCashAzn = Number(linkedCash._sum.amount ?? 0);
    const linkedBankAzn = Number(linkedBank._sum.amount ?? 0);
    const unlinkedCashAzn = Number(unlinkedCash._sum.amount ?? 0);
    const unlinkedBankAzn = Number(unlinkedBank._sum.amount ?? 0);
    const linkedPaymentsAzn = linkedCashAzn + linkedBankAzn;
    const unlinkedPaymentsAzn = unlinkedCashAzn + unlinkedBankAzn;
    const totalAzn = linkedPaymentsAzn + unlinkedPaymentsAzn;

    return {
      year,
      totalAzn,
      linkedPaymentsAzn,
      unlinkedPaymentsAzn,
      linkedCashAzn,
      linkedBankAzn,
      unlinkedCashAzn,
      unlinkedBankAzn,
    };
  }

  async getVatThresholdMonitorSnapshot(
    organizationId: string,
    ref: Date = new Date(),
  ): Promise<VatThresholdMonitorSnapshot> {
    const breakdown = await this.getCurrentYearTurnover(organizationId, ref);
    const { year, totalAzn, linkedPaymentsAzn, unlinkedPaymentsAzn } = breakdown;
    const ratio =
      VAT_REGISTRATION_THRESHOLD_AZN > 0
        ? totalAzn / VAT_REGISTRATION_THRESHOLD_AZN
        : 0;
    const progressPct = Math.min(100, Math.round(ratio * 1000) / 10);
    let band: VatThresholdMonitorSnapshot["band"] = "green";
    if (totalAzn > VAT_TURNOVER_CRITICAL_AZN) band = "red";
    else if (totalAzn >= VAT_TURNOVER_WARN_AZN) band = "yellow";

    return {
      year,
      turnoverAzn: totalAzn,
      linkedPaymentsAzn,
      unlinkedPaymentsAzn,
      invoiceTotalAzn: linkedPaymentsAzn,
      cashStandaloneAzn: unlinkedPaymentsAzn,
      thresholdAzn: VAT_REGISTRATION_THRESHOLD_AZN,
      warnAtAzn: VAT_TURNOVER_WARN_AZN,
      criticalAtAzn: VAT_TURNOVER_CRITICAL_AZN,
      ratio,
      progressPct,
      band,
    };
  }

  /**
   * One RiskAudit row per org per year (`dedupeKey`), MEDIUM above 160k AZN, HIGH above 190k AZN.
   */
  async buildRiskAuditCandidate(
    organizationId: string,
    ref: Date = new Date(),
  ): Promise<TaxLimitRiskScanRow | null> {
    const breakdown = await this.getCurrentYearTurnover(organizationId, ref);
    const { year, totalAzn } = breakdown;

    if (totalAzn <= VAT_TURNOVER_WARN_AZN) {
      return null;
    }

    const severity =
      totalAzn > VAT_TURNOVER_CRITICAL_AZN
        ? RiskSeverity.HIGH
        : RiskSeverity.MEDIUM;

    const dedupeKey = `tax_vat_threshold_ytd_${year}`;
    const ratio = totalAzn / VAT_REGISTRATION_THRESHOLD_AZN;
    const bounds = this.getBakuCalendarYearBoundsUtc(year);

    return {
      dedupeKey,
      type: RiskAuditType.TAX,
      severity,
      description: `YTD revenue (AZN) toward VAT registration reference: ${totalAzn.toFixed(2)} AZN (${(ratio * 100).toFixed(1)}% of ${VAT_REGISTRATION_THRESHOLD_AZN} AZN). Cash-method payments in Baku calendar year ${year} (linked + standalone; see metadata).`,
      metadata: {
        year,
        timezone: "Asia/Baku",
        bakuYearStartUtc: bounds.start.toISOString(),
        bakuYearEndUtc: bounds.end.toISOString(),
        totalAzn,
        linkedPaymentsAzn: breakdown.linkedPaymentsAzn,
        unlinkedPaymentsAzn: breakdown.unlinkedPaymentsAzn,
        linkedCashAzn: breakdown.linkedCashAzn,
        linkedBankAzn: breakdown.linkedBankAzn,
        unlinkedCashAzn: breakdown.unlinkedCashAzn,
        unlinkedBankAzn: breakdown.unlinkedBankAzn,
        invoiceTotalAzn: breakdown.linkedPaymentsAzn,
        cashStandaloneAzn: breakdown.unlinkedPaymentsAzn,
        thresholdAzn: VAT_REGISTRATION_THRESHOLD_AZN,
        warnAtAzn: VAT_TURNOVER_WARN_AZN,
        criticalAtAzn: VAT_TURNOVER_CRITICAL_AZN,
        scanner: "TaxLimitService",
        turnoverMethod: "cash_linked_and_unlinked_payments",
      },
    };
  }
}
