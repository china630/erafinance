import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FixedAssetDepreciationMethod,
  FixedAssetStatus,
  Prisma,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import {
  ACCUMULATED_DEPRECIATION_ACCOUNT_CODE,
  DEPRECIATION_EXPENSE_ACCOUNT_CODE,
} from "../ledger.constants";
import { monthRangeUtc } from "../reporting/reporting-period.util";
import { roundMoney2 } from "./decimal-round";

const Decimal = Prisma.Decimal;

@Injectable()
export class DepreciationService {
  constructor(private readonly accounting: AccountingService) {}

  async runMonthlyDepreciation(
    tx: Prisma.TransactionClient,
    organizationId: string,
    year: number,
    month: number,
  ): Promise<{
    transactionId: string | null;
    totalAmount: string;
    assetsCount: number;
    uopTransactionId: string | null;
    uopTotalAmount: string;
    uopAssetsCount: number;
  }> {
    const slRb = await this.applySlRbForClosedMonth(tx, organizationId, year, month);
    const uop = await this.applyUopForClosedMonth(tx, organizationId, year, month);
    return {
      transactionId: slRb.transactionId,
      totalAmount: new Decimal(slRb.totalAmount).add(uop.totalAmount).toString(),
      assetsCount: slRb.assetsCount + uop.assetsCount,
      uopTransactionId: uop.transactionId,
      uopTotalAmount: uop.totalAmount,
      uopAssetsCount: uop.assetsCount,
    };
  }

  /**
   * Monthly depreciation for STRAIGHT_LINE and REDUCING_BALANCE.
   */
  async applySlRbForClosedMonth(
    tx: Prisma.TransactionClient,
    organizationId: string,
    year: number,
    month: number,
  ): Promise<{ transactionId: string | null; totalAmount: string; assetsCount: number }> {
    const { end } = monthRangeUtc(year, month);
    const monthEnd = end;

    const assets = await tx.fixedAsset.findMany({
      where: {
        organizationId,
        status: FixedAssetStatus.ACTIVE,
        depreciationMethod: {
          in: [
            FixedAssetDepreciationMethod.STRAIGHT_LINE,
            FixedAssetDepreciationMethod.REDUCING_BALANCE,
          ],
        },
      },
    });

    type Row = { assetId: string; amount: Prisma.Decimal };
    const rows: Row[] = [];

    for (const a of assets) {
      const exists = await tx.fixedAssetDepreciationMonth.findUnique({
        where: {
          fixedAssetId_year_month: {
            fixedAssetId: a.id,
            year,
            month,
          },
        },
      });
      if (exists) continue;

      const comm = a.purchaseDate;
      if (comm.getTime() > monthEnd.getTime()) continue;

      const maxDep = new Decimal(a.purchasePrice).sub(a.salvageValue);
      if (maxDep.lte(0)) continue;

      const booked = new Decimal(a.bookedDepreciation);
      const remaining = maxDep.sub(booked);
      if (remaining.lte(0)) continue;

      let amount: Prisma.Decimal | null = null;
      if (a.depreciationMethod === FixedAssetDepreciationMethod.STRAIGHT_LINE) {
        const life = new Decimal(a.usefulLifeMonths);
        const monthly = roundMoney2(maxDep.div(life));
        amount = monthly;
        if (amount.gt(remaining)) {
          amount = roundMoney2(remaining);
        }
      } else if (
        a.depreciationMethod === FixedAssetDepreciationMethod.REDUCING_BALANCE
      ) {
        amount = this.computeReducingBalanceMonthlyAmount(a, remaining);
      }

      if (!amount || amount.lte(0)) continue;

      rows.push({ assetId: a.id, amount });
    }

    if (rows.length === 0) {
      return { transactionId: null, totalAmount: "0", assetsCount: 0 };
    }

    let total = new Decimal(0);
    const lines: { accountCode: string; debit: string; credit: string }[] = [];
    for (const r of rows) {
      total = total.add(r.amount);
      lines.push({
        accountCode: DEPRECIATION_EXPENSE_ACCOUNT_CODE,
        debit: r.amount.toString(),
        credit: "0",
      });
    }
    lines.push({
      accountCode: ACCUMULATED_DEPRECIATION_ACCOUNT_CODE,
      debit: "0",
      credit: roundMoney2(total).toString(),
    });

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date: monthEnd,
      reference: `DEPR-${year}-${String(month).padStart(2, "0")}`,
      description: `Амортизация ОС ${month}/${year}`,
      isFinal: true,
      lines,
    });

    for (const r of rows) {
      await tx.fixedAssetDepreciationMonth.create({
        data: {
          organizationId,
          fixedAssetId: r.assetId,
          year,
          month,
          amount: r.amount,
          transactionId,
        },
      });
      await tx.fixedAsset.update({
        where: { id: r.assetId },
        data: {
          bookedDepreciation: {
            increment: r.amount,
          },
        },
      });
    }

    return {
      transactionId,
      totalAmount: roundMoney2(total).toString(),
      assetsCount: rows.length,
    };
  }

  /**
   * Monthly depreciation for UNITS_OF_PRODUCTION using {@link FixedAssetMonthlyUsage}.
   */
  async applyUopForClosedMonth(
    tx: Prisma.TransactionClient,
    organizationId: string,
    year: number,
    month: number,
  ): Promise<{ transactionId: string | null; totalAmount: string; assetsCount: number }> {
    const { end } = monthRangeUtc(year, month);
    const monthEnd = end;

    const usages = await tx.fixedAssetMonthlyUsage.findMany({
      where: { organizationId, year, month },
      include: { fixedAsset: true },
    });

    type Row = {
      assetId: string;
      amount: Prisma.Decimal;
      periodUnits: Prisma.Decimal;
    };
    const rows: Row[] = [];

    for (const u of usages) {
      const a = u.fixedAsset;
      if (a.status !== FixedAssetStatus.ACTIVE) continue;
      if (a.depreciationMethod !== FixedAssetDepreciationMethod.UNITS_OF_PRODUCTION) {
        continue;
      }
      if (a.purchaseDate.getTime() > monthEnd.getTime()) continue;

      const exists = await tx.fixedAssetDepreciationMonth.findUnique({
        where: {
          fixedAssetId_year_month: {
            fixedAssetId: a.id,
            year,
            month,
          },
        },
      });
      if (exists) continue;

      const amount = this.computeUopAmount(a, u.periodUnits);
      if (!amount || amount.lte(0)) continue;

      rows.push({ assetId: a.id, amount, periodUnits: u.periodUnits });
    }

    if (rows.length === 0) {
      return { transactionId: null, totalAmount: "0", assetsCount: 0 };
    }

    let total = new Decimal(0);
    const lines: { accountCode: string; debit: string; credit: string }[] = [];
    for (const r of rows) {
      total = total.add(r.amount);
      lines.push({
        accountCode: DEPRECIATION_EXPENSE_ACCOUNT_CODE,
        debit: r.amount.toString(),
        credit: "0",
      });
    }
    lines.push({
      accountCode: ACCUMULATED_DEPRECIATION_ACCOUNT_CODE,
      debit: "0",
      credit: roundMoney2(total).toString(),
    });

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date: monthEnd,
      reference: `DEPR-UOP-${year}-${String(month).padStart(2, "0")}`,
      description: `Амортизация ОС (выработка) ${month}/${year}`,
      isFinal: true,
      lines,
    });

    for (const r of rows) {
      await tx.fixedAssetDepreciationMonth.create({
        data: {
          organizationId,
          fixedAssetId: r.assetId,
          year,
          month,
          amount: r.amount,
          transactionId,
        },
      });
      await tx.fixedAsset.update({
        where: { id: r.assetId },
        data: {
          bookedDepreciation: { increment: r.amount },
          unitsProducedTotal: { increment: r.periodUnits },
        },
      });
    }

    return {
      transactionId,
      totalAmount: roundMoney2(total).toString(),
      assetsCount: rows.length,
    };
  }

  /** @deprecated Use runMonthlyDepreciation */
  async applyForClosedMonth(
    tx: Prisma.TransactionClient,
    organizationId: string,
    year: number,
    month: number,
  ) {
    return this.runMonthlyDepreciation(tx, organizationId, year, month);
  }

  private computeUopAmount(
    a: {
      purchasePrice: Prisma.Decimal;
      salvageValue: Prisma.Decimal;
      bookedDepreciation: Prisma.Decimal;
      totalExpectedUnits: Prisma.Decimal | null;
    },
    periodUnits: Prisma.Decimal | number,
  ): Prisma.Decimal | null {
    if (!a.totalExpectedUnits || new Decimal(a.totalExpectedUnits).lte(0)) {
      return null;
    }
    const pu = new Decimal(periodUnits);
    if (pu.lte(0)) return null;

    const maxDep = new Decimal(a.purchasePrice).sub(a.salvageValue);
    if (maxDep.lte(0)) return null;

    const remaining = maxDep.sub(a.bookedDepreciation);
    if (remaining.lte(0)) return null;

    let amount = roundMoney2(maxDep.mul(pu).div(a.totalExpectedUnits));
    if (amount.gt(remaining)) {
      amount = roundMoney2(remaining);
    }
    if (amount.lte(0)) return null;
    return amount;
  }

  private computeReducingBalanceMonthlyAmount(
    a: {
      purchasePrice: Prisma.Decimal;
      bookedDepreciation: Prisma.Decimal;
      salvageValue: Prisma.Decimal;
      decliningBalanceRate: Prisma.Decimal | null;
    },
    remainingDepreciable: Prisma.Decimal,
  ): Prisma.Decimal | null {
    const rateRaw = a.decliningBalanceRate;
    if (rateRaw == null) return null;
    const rAnnual = new Decimal(rateRaw);
    if (rAnnual.lte(0)) return null;

    const nbv = new Decimal(a.purchasePrice).sub(a.bookedDepreciation);
    const salvage = new Decimal(a.salvageValue);
    if (nbv.lte(salvage)) return null;

    let monthly = roundMoney2(nbv.mul(rAnnual).div(12));
    const capToSalvage = roundMoney2(nbv.sub(salvage));
    if (monthly.gt(capToSalvage)) {
      monthly = capToSalvage;
    }
    if (monthly.gt(remainingDepreciable)) {
      monthly = roundMoney2(remainingDepreciable);
    }
    if (monthly.lte(0)) return null;
    return monthly;
  }

  /**
   * Record production units and post depreciation for UNITS_OF_PRODUCTION (immediate journal).
   */
  async recordUnitsOfProductionUsage(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    periodUnits: number,
  ): Promise<{ transactionId: string; amount: string }> {
    const a = await tx.fixedAsset.findFirst({
      where: { id: assetId, organizationId },
    });
    if (!a) {
      throw new NotFoundException("Fixed asset not found");
    }
    if (a.depreciationMethod !== FixedAssetDepreciationMethod.UNITS_OF_PRODUCTION) {
      throw new BadRequestException({
        code: "DEPRECIATION_METHOD_NOT_UOP",
        message: "Record usage is only for UNITS_OF_PRODUCTION assets",
      });
    }
    if (!a.totalExpectedUnits || new Decimal(a.totalExpectedUnits).lte(0)) {
      throw new BadRequestException({
        code: "TOTAL_EXPECTED_UNITS_REQUIRED",
        message: "totalExpectedUnits must be set and positive",
      });
    }

    const pu = new Decimal(periodUnits);
    if (pu.lte(0)) {
      throw new BadRequestException("periodUnits must be positive");
    }

    const maxDep = new Decimal(a.purchasePrice).sub(a.salvageValue);
    if (maxDep.lte(0)) {
      throw new BadRequestException("Nothing to depreciate (purchasePrice <= salvage)");
    }

    const booked = new Decimal(a.bookedDepreciation);
    const remaining = maxDep.sub(booked);
    if (remaining.lte(0)) {
      throw new BadRequestException("Asset is already fully depreciated");
    }

    const rawAmount = maxDep.mul(pu).div(a.totalExpectedUnits);
    let amount = roundMoney2(rawAmount);
    if (amount.gt(remaining)) {
      amount = roundMoney2(remaining);
    }
    if (amount.lte(0)) {
      throw new BadRequestException("Computed depreciation amount is zero");
    }

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const { end } = monthRangeUtc(y, m);

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date: end,
      reference: `DEPR-UOP-${y}-${String(m).padStart(2, "0")}-${assetId.slice(0, 8)}`,
      description: `Амортизация ОС (выработка) ${a.name}`,
      isFinal: true,
      lines: [
        {
          accountCode: DEPRECIATION_EXPENSE_ACCOUNT_CODE,
          debit: amount.toString(),
          credit: "0",
        },
        {
          accountCode: ACCUMULATED_DEPRECIATION_ACCOUNT_CODE,
          debit: "0",
          credit: amount.toString(),
        },
      ],
    });

    await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        bookedDepreciation: { increment: amount },
        unitsProducedTotal: { increment: pu },
      },
    });

    return { transactionId, amount: amount.toString() };
  }
}
