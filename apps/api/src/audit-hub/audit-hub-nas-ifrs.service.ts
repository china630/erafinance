import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import type { NasIfrsQueryDto } from "./dto/nas-ifrs-query.dto";

function defaultPeriod(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 86_400_000);
  return { from, to };
}

@Injectable()
export class AuditHubNasIfrsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(organizationId: string, query: NasIfrsQueryDto) {
    const take = query.take ?? 200;
    const includeTotalsMismatch = query.includeTotalsMismatch === true;
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

    const rows = await this.prisma.$queryRaw<
      Array<{
        transactionId: string;
        date: Date;
        reference: string | null;
        hasNas: boolean;
        hasIfrs: boolean;
      }>
    >(Prisma.sql`
      SELECT
        t.id AS "transactionId",
        t.date AS "date",
        t.reference AS "reference",
        BOOL_OR(je.ledger_type = CAST('NAS' AS "LedgerType")) AS "hasNas",
        BOOL_OR(je.ledger_type = CAST('IFRS' AS "LedgerType")) AS "hasIfrs"
      FROM transactions t
      INNER JOIN journal_entries je
        ON je.transaction_id = t.id
        AND je.organization_id = t.organization_id
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.is_final = true
        AND t.date >= ${from}::date
        AND t.date <= ${to}::date
      GROUP BY t.id, t.date, t.reference
      HAVING BOOL_OR(je.ledger_type = CAST('NAS' AS "LedgerType"))
        IS DISTINCT FROM
        BOOL_OR(je.ledger_type = CAST('IFRS' AS "LedgerType"))
      ORDER BY t.date DESC, t.id
      LIMIT ${take}
    `);

    let totalsMismatchItems: Array<{
      transactionId: string;
      date: string;
      reference: string | null;
      issue: string;
      nasDebitSum: string;
      ifrsDebitSum: string;
    }> = [];

    if (includeTotalsMismatch) {
      const parity = await this.prisma.$queryRaw<
        Array<{
          transactionId: string;
          date: Date;
          reference: string | null;
          nasDebitSum: unknown;
          ifrsDebitSum: unknown;
        }>
      >(Prisma.sql`
        SELECT
          t.id AS "transactionId",
          t.date AS "date",
          t.reference AS "reference",
          SUM(CASE WHEN je.ledger_type = CAST('NAS' AS "LedgerType") THEN je.debit ELSE 0 END) AS "nasDebitSum",
          SUM(CASE WHEN je.ledger_type = CAST('IFRS' AS "LedgerType") THEN je.debit ELSE 0 END) AS "ifrsDebitSum"
        FROM transactions t
        INNER JOIN journal_entries je
          ON je.transaction_id = t.id
          AND je.organization_id = t.organization_id
        WHERE t.organization_id = ${organizationId}::uuid
          AND t.is_final = true
          AND t.date >= ${from}::date
          AND t.date <= ${to}::date
        GROUP BY t.id, t.date, t.reference
        HAVING BOOL_OR(je.ledger_type = CAST('NAS' AS "LedgerType"))
          AND BOOL_OR(je.ledger_type = CAST('IFRS' AS "LedgerType"))
          AND ABS(
            SUM(CASE WHEN je.ledger_type = CAST('NAS' AS "LedgerType") THEN je.debit ELSE 0 END)
            - SUM(CASE WHEN je.ledger_type = CAST('IFRS' AS "LedgerType") THEN je.debit ELSE 0 END)
          ) > CAST(0.0001 AS DECIMAL)
        ORDER BY t.date DESC, t.id
        LIMIT ${take}
      `);
      totalsMismatchItems = parity.map((r) => ({
        transactionId: r.transactionId,
        date: r.date.toISOString().slice(0, 10),
        reference: r.reference,
        issue: "TOTAL_DEBIT_MISMATCH",
        nasDebitSum: String(r.nasDebitSum),
        ifrsDebitSum: String(r.ifrsDebitSum),
      }));
    }

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      includeTotalsMismatch,
      items: rows.map((r) => ({
        transactionId: r.transactionId,
        date: r.date.toISOString().slice(0, 10),
        reference: r.reference,
        hasNas: r.hasNas,
        hasIfrs: r.hasIfrs,
        issue: r.hasNas && !r.hasIfrs ? "MISSING_IFRS" : "MISSING_NAS",
      })),
      totalsMismatchItems,
    };
  }
}
