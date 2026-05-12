import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import type { AuditHubRiskQueryDto } from "./dto/risk-query.dto";

function defaultPeriod(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 86_400_000);
  return { from, to };
}

@Injectable()
export class AuditHubRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async report(organizationId: string, query: AuditHubRiskQueryDto) {
    const windowDays = query.windowDays ?? 7;
    const take = query.take ?? 100;
    const expenseMinDebit = query.expenseMinDebit ?? 50_000;
    let from = query.from ? new Date(query.from) : undefined;
    let to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({ code: "INVALID_FROM" });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({ code: "INVALID_TO" });
    }
    if (!from || !to) {
      const d = defaultPeriod();
      from = d.from;
      to = d.to;
    }

    const [
      pairs,
      paymentPairs,
      expenseSpikes,
      counterpartyLoad,
      zScoreItems,
    ] = await Promise.all([
      this.duplicateCashOrders(
        organizationId,
        from,
        to,
        windowDays,
        take,
      ),
      this.duplicateInvoicePayments(
        organizationId,
        from,
        to,
        windowDays,
        take,
      ),
      this.expenseAccountSpikes(
        organizationId,
        from,
        to,
        expenseMinDebit,
        Math.min(50, take),
      ),
      this.counterpartyPaymentConcentration(
        organizationId,
        from,
        to,
        Math.min(15, take),
      ),
      this.counterpartyPaymentZScores(organizationId, from, to, Math.min(40, take)),
    ]);

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      windowDays,
      detectors: {
        duplicateCashOrders: { pairs },
        duplicateInvoicePayments: { pairs: paymentPairs },
        expenseAccountSpikes: { items: expenseSpikes },
        counterpartyPaymentConcentration: { items: counterpartyLoad },
        counterpartyZScore: {
          items: zScoreItems,
          note: "Per-counterparty invoice_payment totals vs cohort mean/std; |z|≥2 (heuristic)",
        },
      },
    };
  }

  private async duplicateCashOrders(
    organizationId: string,
    from: Date,
    to: Date,
    windowDays: number,
    take: number,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        idA: string;
        idB: string;
        dateA: Date;
        dateB: Date;
        orderNumberA: string;
        orderNumberB: string;
        amount: unknown;
        cashAccountCode: string;
        counterpartyId: string | null;
        dateGapDays: number;
      }>
    >(Prisma.sql`
      SELECT
        a.id AS "idA",
        b.id AS "idB",
        a.date AS "dateA",
        b.date AS "dateB",
        a.order_number AS "orderNumberA",
        b.order_number AS "orderNumberB",
        a.amount AS "amount",
        a.cash_account_code AS "cashAccountCode",
        a.counterparty_id AS "counterpartyId",
        (ABS(a.date - b.date))::int AS "dateGapDays"
      FROM cash_orders a
      INNER JOIN cash_orders b
        ON b.organization_id = a.organization_id
        AND b.id > a.id
        AND b.status = CAST('POSTED' AS "CashOrderStatus")
        AND a.status = CAST('POSTED' AS "CashOrderStatus")
        AND a.amount = b.amount
        AND a.cash_account_code = b.cash_account_code
        AND a.counterparty_id IS NOT DISTINCT FROM b.counterparty_id
        AND a.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND ABS(a.date - b.date) <= ${windowDays}::int
      WHERE a.organization_id = ${organizationId}::uuid
        AND a.date >= ${from}::date
        AND a.date <= ${to}::date
      ORDER BY a.date DESC, a.amount DESC
      LIMIT ${take}
    `);
    return rows.map((p) => ({
      cashOrderIdA: p.idA,
      cashOrderIdB: p.idB,
      dateA: p.dateA.toISOString().slice(0, 10),
      dateB: p.dateB.toISOString().slice(0, 10),
      orderNumberA: p.orderNumberA,
      orderNumberB: p.orderNumberB,
      amount: String(p.amount),
      cashAccountCode: p.cashAccountCode,
      counterpartyId: p.counterpartyId,
      dateGapDays: p.dateGapDays,
    }));
  }

  private async duplicateInvoicePayments(
    organizationId: string,
    from: Date,
    to: Date,
    windowDays: number,
    take: number,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        idA: string;
        idB: string;
        dateA: Date;
        dateB: Date;
        amount: unknown;
        counterpartyId: string | null;
        invoiceIdA: string;
        invoiceIdB: string;
        dateGapDays: number;
      }>
    >(Prisma.sql`
      SELECT
        a.id AS "idA",
        b.id AS "idB",
        a.date AS "dateA",
        b.date AS "dateB",
        a.amount AS "amount",
        i1.counterparty_id AS "counterpartyId",
        a.invoice_id AS "invoiceIdA",
        b.invoice_id AS "invoiceIdB",
        (ABS(a.date - b.date))::int AS "dateGapDays"
      FROM invoice_payments a
      INNER JOIN invoices i1 ON i1.id = a.invoice_id AND i1.organization_id = a.organization_id
      INNER JOIN invoice_payments b
        ON b.organization_id = a.organization_id
        AND b.id > a.id
        AND b.deleted_at IS NULL
        AND a.deleted_at IS NULL
        AND b.amount = a.amount
        AND a.invoice_id <> b.invoice_id
      INNER JOIN invoices i2 ON i2.id = b.invoice_id AND i2.organization_id = b.organization_id
      WHERE a.organization_id = ${organizationId}::uuid
        AND i1.counterparty_id IS NOT NULL
        AND i1.counterparty_id IS NOT DISTINCT FROM i2.counterparty_id
        AND a.date >= ${from}::date
        AND a.date <= ${to}::date
        AND ABS(a.date - b.date) <= ${windowDays}::int
      ORDER BY a.date DESC, a.amount DESC
      LIMIT ${take}
    `);
    return rows.map((p) => ({
      invoicePaymentIdA: p.idA,
      invoicePaymentIdB: p.idB,
      invoiceIdA: p.invoiceIdA,
      invoiceIdB: p.invoiceIdB,
      dateA: p.dateA.toISOString().slice(0, 10),
      dateB: p.dateB.toISOString().slice(0, 10),
      amount: String(p.amount),
      counterpartyId: p.counterpartyId,
      dateGapDays: p.dateGapDays,
    }));
  }

  private async expenseAccountSpikes(
    organizationId: string,
    from: Date,
    to: Date,
    minDebit: number,
    take: number,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        accountId: string;
        accountCode: string;
        totalDebit: unknown;
      }>
    >(Prisma.sql`
      SELECT
        a.id AS "accountId",
        a.code AS "accountCode",
        SUM(je.debit) AS "totalDebit"
      FROM journal_entries je
      INNER JOIN accounts a ON a.id = je.account_id
      INNER JOIN transactions t ON t.id = je.transaction_id
      WHERE je.organization_id = ${organizationId}::uuid
        AND t.is_final = true
        AND t.date >= ${from}::date
        AND t.date <= ${to}::date
        AND je.ledger_type = CAST('NAS' AS "LedgerType")
        AND a.type = CAST('EXPENSE' AS "AccountType")
        AND a.deleted_at IS NULL
      GROUP BY a.id, a.code
      HAVING SUM(je.debit) >= ${minDebit}::decimal
      ORDER BY SUM(je.debit) DESC
      LIMIT ${take}
    `);
    return rows.map((r) => ({
      accountId: r.accountId,
      accountCode: r.accountCode,
      totalDebitNas: String(r.totalDebit),
    }));
  }

  private async counterpartyPaymentConcentration(
    organizationId: string,
    from: Date,
    to: Date,
    take: number,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        counterpartyId: string;
        paymentCount: bigint;
        totalAmount: unknown;
      }>
    >(Prisma.sql`
      SELECT
        i.counterparty_id AS "counterpartyId",
        COUNT(*)::bigint AS "paymentCount",
        SUM(ip.amount) AS "totalAmount"
      FROM invoice_payments ip
      INNER JOIN invoices i ON i.id = ip.invoice_id AND i.organization_id = ip.organization_id
      WHERE ip.organization_id = ${organizationId}::uuid
        AND ip.deleted_at IS NULL
        AND i.counterparty_id IS NOT NULL
        AND ip.date >= ${from}::date
        AND ip.date <= ${to}::date
      GROUP BY i.counterparty_id
      HAVING COUNT(*) >= 3
      ORDER BY SUM(ip.amount) DESC
      LIMIT ${take}
    `);
    return rows.map((r) => ({
      counterpartyId: r.counterpartyId,
      paymentCount: Number(r.paymentCount),
      totalAmount: String(r.totalAmount),
    }));
  }

  private async counterpartyPaymentZScores(
    organizationId: string,
    from: Date,
    to: Date,
    take: number,
  ): Promise<
    Array<{
      counterpartyId: string;
      totalAmount: string;
      paymentCount: number;
      zScore: number;
      cohortMean: number;
      cohortStd: number;
    }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{
        counterpartyId: string;
        paymentCount: bigint;
        totalAmount: unknown;
      }>
    >(Prisma.sql`
      SELECT
        i.counterparty_id AS "counterpartyId",
        COUNT(*)::bigint AS "paymentCount",
        SUM(ip.amount) AS "totalAmount"
      FROM invoice_payments ip
      INNER JOIN invoices i ON i.id = ip.invoice_id AND i.organization_id = ip.organization_id
      WHERE ip.organization_id = ${organizationId}::uuid
        AND ip.deleted_at IS NULL
        AND i.counterparty_id IS NOT NULL
        AND ip.date >= ${from}::date
        AND ip.date <= ${to}::date
      GROUP BY i.counterparty_id
      HAVING COUNT(*) >= 2
      ORDER BY SUM(ip.amount) DESC
      LIMIT 200
    `);
    const totals = rows.map((r) => ({
      counterpartyId: r.counterpartyId,
      paymentCount: Number(r.paymentCount),
      total: Number(r.totalAmount),
    }));
    if (totals.length < 4) {
      return [];
    }
    const amounts = totals.map((t) => t.total);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance =
      amounts.reduce((s, x) => s + (x - mean) ** 2, 0) / amounts.length;
    const std = Math.sqrt(variance) || 1;
    const flagged = totals
      .map((t) => ({
        counterpartyId: t.counterpartyId,
        totalAmount: String(t.total),
        paymentCount: t.paymentCount,
        zScore: (t.total - mean) / std,
        cohortMean: mean,
        cohortStd: std,
      }))
      .filter((t) => Math.abs(t.zScore) >= 2)
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      .slice(0, take);
    return flagged.map((t) => ({
      counterpartyId: t.counterpartyId,
      totalAmount: t.totalAmount,
      paymentCount: t.paymentCount,
      zScore: Math.round(t.zScore * 1000) / 1000,
      cohortMean: Math.round(t.cohortMean * 100) / 100,
      cohortStd: Math.round(t.cohortStd * 100) / 100,
    }));
  }
}
