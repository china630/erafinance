import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerType } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

const ALL_TYPES = new Set([
  "journal_posting",
  "invoice",
  "fx_snapshot",
  "fixed_asset_depreciation",
  "payroll_accrual",
]);

@Injectable()
export class AuditHubCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async explain(organizationId: string, type: string, id: string) {
    const t = type.trim().toLowerCase();
    if (!ALL_TYPES.has(t)) {
      throw new BadRequestException({
        code: "AUDIT_CALC_UNKNOWN_TYPE",
        message: `Unknown type. Allowed: ${[...ALL_TYPES].sort().join(", ")}`,
      });
    }
    if (t === "fx_snapshot") {
      const rate = await this.prisma.cbarOfficialRate.findUnique({
        where: { id },
        select: {
          id: true,
          rateDate: true,
          currencyCode: true,
          value: true,
          nominal: true,
          rate: true,
          status: true,
        },
      });
      if (!rate) {
        throw new NotFoundException();
      }
      return {
        schemaVersion: 1,
        type: "fx_snapshot",
        id: rate.id,
        summary: {
          implemented: true,
          scope: "platform",
          rateDate: rate.rateDate.toISOString().slice(0, 10),
          currencyCode: rate.currencyCode,
          value: rate.value.toString(),
          nominal: rate.nominal,
          rate: rate.rate.toString(),
          status: rate.status,
        },
        rationale:
          "CBAR official FX row (global catalog, not tenant-scoped). Used for AZN conversion and regulatory reference; compare with invoice/transaction dates when reviewing foreign-currency postings.",
      };
    }
    if (t === "fixed_asset_depreciation") {
      const row = await this.prisma.fixedAssetDepreciationMonth.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: {
          id: true,
          year: true,
          month: true,
          amount: true,
          transactionId: true,
          fixedAsset: {
            select: {
              id: true,
              name: true,
              inventoryNumber: true,
              purchasePrice: true,
              usefulLifeMonths: true,
              depreciationMethod: true,
            },
          },
        },
      });
      if (!row) {
        throw new NotFoundException();
      }
      return {
        schemaVersion: 1,
        type: "fixed_asset_depreciation",
        id: row.id,
        summary: {
          implemented: true,
          organizationId,
          calendarMonth: `${row.year}-${String(row.month).padStart(2, "0")}`,
          amount: row.amount.toString(),
          postedTransactionId: row.transactionId,
          fixedAsset: {
            id: row.fixedAsset.id,
            name: row.fixedAsset.name,
            inventoryNumber: row.fixedAsset.inventoryNumber,
            initialCost: row.fixedAsset.purchasePrice.toString(),
            usefulLifeMonths: row.fixedAsset.usefulLifeMonths,
            depreciationMethod: row.fixedAsset.depreciationMethod,
          },
        },
        rationale:
          "Monthly depreciation accrual for a fixed asset (FixedAssetDepreciationMonth). When transactionId is set, the accrual is posted as a Transaction; use journal_posting on that id for NAS line detail.",
      };
    }
    if (t === "payroll_accrual") {
      const run = await this.prisma.payrollRun.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
          transactionId: true,
          timesheetId: true,
          _count: { select: { slips: true } },
        },
      });
      if (!run) {
        throw new NotFoundException();
      }
      const agg = await this.prisma.payrollSlip.aggregate({
        where: { payrollRunId: run.id, organizationId, deletedAt: null },
        _sum: {
          gross: true,
          net: true,
          incomeTax: true,
          dsmfEmployer: true,
          itsEmployer: true,
        },
      });
      return {
        schemaVersion: 1,
        type: "payroll_accrual",
        id: run.id,
        summary: {
          implemented: true,
          organizationId,
          calendarMonth: `${run.year}-${String(run.month).padStart(2, "0")}`,
          status: run.status,
          slipCount: run._count.slips,
          postedTransactionId: run.transactionId,
          timesheetId: run.timesheetId,
          slipTotals: {
            gross: agg._sum.gross?.toString() ?? "0",
            net: agg._sum.net?.toString() ?? "0",
            incomeTax: agg._sum.incomeTax?.toString() ?? "0",
            dsmfEmployer: agg._sum.dsmfEmployer?.toString() ?? "0",
            itsEmployer: agg._sum.itsEmployer?.toString() ?? "0",
          },
        },
        rationale:
          "Payroll run aggregates slips for the month; employer-side accruals feed NAS postings when the run is posted (see transactionId + journal_posting).",
      };
    }
    if (t === "invoice") {
      const inv = await this.prisma.invoice.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: {
          id: true,
          number: true,
          dueDate: true,
          totalAmount: true,
          currency: true,
          status: true,
        },
      });
      if (!inv) {
        throw new NotFoundException();
      }
      return {
        schemaVersion: 1,
        type: "invoice",
        id: inv.id,
        summary: {
          number: inv.number,
          dueDate: inv.dueDate.toISOString().slice(0, 10),
          totalAmount: inv.totalAmount.toString(),
          currency: inv.currency,
          status: inv.status,
        },
        rationale:
          "Invoice totals and dates are persisted on the invoice record; ledger postings are linked via related transactions (see journal_posting for the same business operation when posted).",
      };
    }
    const tx = await this.prisma.transaction.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        date: true,
        reference: true,
        isFinal: true,
        journalEntries: {
          select: {
            id: true,
            ledgerType: true,
            debit: true,
            credit: true,
            account: { select: { code: true, nameRu: true } },
          },
        },
      },
    });
    if (!tx) {
      throw new NotFoundException();
    }
    let nasDebit = 0;
    let nasCredit = 0;
    for (const je of tx.journalEntries) {
      if (je.ledgerType !== LedgerType.NAS) {
        continue;
      }
      nasDebit += Number(je.debit);
      nasCredit += Number(je.credit);
    }
    const balanced = Math.abs(nasDebit - nasCredit) < 0.000_001;
    return {
      schemaVersion: 1,
      type: "journal_posting",
      id: tx.id,
      summary: {
        date: tx.date.toISOString().slice(0, 10),
        reference: tx.reference,
        isFinal: tx.isFinal,
        nasDebitTotal: String(nasDebit),
        nasCreditTotal: String(nasCredit),
        nasBalanced: balanced,
        lines: tx.journalEntries.map((je) => ({
          id: je.id,
          ledgerType: je.ledgerType,
          accountCode: je.account.code,
          accountName: je.account.nameRu,
          debit: je.debit.toString(),
          credit: je.credit.toString(),
        })),
      },
      rationale:
        "NAS layer totals: sum of debit should equal sum of credit for a balanced journal transaction. IFRS lines are omitted in this v1 explain response; use NAS/IFRS reconciliation for cross-ledger checks.",
    };
  }
}
