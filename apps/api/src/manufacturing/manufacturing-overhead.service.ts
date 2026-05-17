import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Decimal,
  LedgerType,
  OverheadDriverType,
  type ManufacturingRelease,
  type OverheadPool,
  type Prisma,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { PrismaService } from "../prisma/prisma.service";
import { monthRangeUtc } from "../reporting/reporting-period.util";
import { roundMoney2 } from "../fixed-assets/decimal-round";
import { MANUFACTURING_OVERHEAD_CREDIT_ACCOUNT_CODE } from "../ledger.constants";
import { CreateOverheadDriverDto } from "./dto/create-overhead-driver.dto";
import { CreateOverheadPoolDto } from "./dto/create-overhead-pool.dto";
import { UpdateOverheadDriverDto } from "./dto/update-overhead-driver.dto";
import {
  AllocateOverheadBatchDto,
  OverheadDistributionKey,
} from "./dto/allocate-overhead-batch.dto";

function parsePeriod(period: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!m) throw new BadRequestException("period must be YYYY-MM");
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new BadRequestException("Invalid month in period");
  return { year, month };
}

function releaseWeight(
  type: OverheadDriverType,
  row: Pick<ManufacturingRelease, "quantity" | "materialCost">,
): Decimal {
  if (type === OverheadDriverType.VOLUME) return new Decimal(row.quantity);
  if (type === OverheadDriverType.MATERIAL_COST) return new Decimal(row.materialCost);
  return new Decimal(1);
}

@Injectable()
export class ManufacturingOverheadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  listDrivers(organizationId: string) {
    return this.prisma.overheadDriver.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async createDriver(organizationId: string, dto: CreateOverheadDriverDto) {
    return this.prisma.overheadDriver.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        type: dto.type,
      },
    });
  }

  async updateDriver(
    organizationId: string,
    id: string,
    dto: UpdateOverheadDriverDto,
  ) {
    const row = await this.prisma.overheadDriver.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Overhead driver not found");
    return this.prisma.overheadDriver.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.type != null ? { type: dto.type } : {}),
      },
    });
  }

  listPools(organizationId: string, period?: string) {
    return this.prisma.overheadPool.findMany({
      where: {
        organizationId,
        ...(period?.trim() ? { period: period.trim() } : {}),
      },
      include: { driver: true },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    });
  }

  async createPool(organizationId: string, dto: CreateOverheadPoolDto) {
    parsePeriod(dto.period);
    const driver = await this.prisma.overheadDriver.findFirst({
      where: { id: dto.driverId, organizationId },
    });
    if (!driver) throw new NotFoundException("Overhead driver not found");
    return this.prisma.overheadPool.create({
      data: {
        organizationId,
        period: dto.period.trim(),
        totalAmount: new Decimal(dto.totalAmount),
        sourceAccountCode: dto.sourceAccountCode.trim(),
        creditAccountCode: (dto.creditAccountCode ?? "741").trim(),
        debitAccountCode: (dto.debitAccountCode ?? "204").trim(),
        driverId: dto.driverId,
      },
      include: { driver: true },
    });
  }

  async getPeriodSummary(organizationId: string, period: string) {
    const trimmed = period.trim();
    const { year, month } = parsePeriod(trimmed);
    const { start, end } = monthRangeUtc(year, month);

    const releases = await this.prisma.manufacturingRelease.findMany({
      where: {
        organizationId,
        documentDate: { gte: start, lte: end },
      },
      include: {
        recipe: { select: { id: true, name: true } },
        finishedProduct: { select: { name: true } },
        overheadAllocations: { select: { amount: true } },
      },
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
    });

    const overheadAccounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        code: MANUFACTURING_OVERHEAD_CREDIT_ACCOUNT_CODE,
      },
      select: { id: true },
    });

    let suggestedOverheadTotal = new Decimal(0);
    if (overheadAccounts.length > 0) {
      const agg = await this.prisma.journalEntry.aggregate({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          accountId: { in: overheadAccounts.map((a) => a.id) },
          debit: { gt: 0 },
          transaction: {
            date: { gte: start, lte: end },
            isFinal: true,
          },
        },
        _sum: { debit: true },
      });
      suggestedOverheadTotal = new Decimal(agg._sum.debit ?? 0);
    }

    const existingPools = await this.listPools(organizationId, trimmed);
    let totalAllocated = new Decimal(0);
    for (const r of releases) {
      for (const a of r.overheadAllocations) {
        totalAllocated = totalAllocated.add(new Decimal(a.amount));
      }
    }

    return {
      period: trimmed,
      suggestedOverheadTotal: roundMoney2(suggestedOverheadTotal).toString(),
      totalAllocated: roundMoney2(totalAllocated).toString(),
      existingPools,
      releases: releases.map((r) => {
        const allocated = r.overheadAllocations.reduce(
          (s, a) => s.add(new Decimal(a.amount)),
          new Decimal(0),
        );
        return {
          id: r.id,
          documentDate: r.documentDate,
          quantity: r.quantity.toString(),
          materialCost: r.materialCost.toString(),
          recipeId: r.recipeId,
          recipeName: r.recipe.name,
          finishedProductName: r.finishedProduct.name,
          allocatedAmount: roundMoney2(allocated).toString(),
        };
      }),
    };
  }

  async allocateBatch(organizationId: string, dto: AllocateOverheadBatchDto) {
    const period = dto.period.trim();
    const { year, month } = parsePeriod(period);
    const { start, end } = monthRangeUtc(year, month);

    const releases = await this.prisma.manufacturingRelease.findMany({
      where: {
        organizationId,
        id: { in: dto.releaseIds },
        documentDate: { gte: start, lte: end },
      },
    });
    if (releases.length !== dto.releaseIds.length) {
      throw new BadRequestException(
        "Some manufacturing releases are invalid for this period",
      );
    }

    const driverType =
      dto.distributionKey === OverheadDistributionKey.QUANTITY
        ? OverheadDriverType.VOLUME
        : OverheadDriverType.MATERIAL_COST;
    const driverName =
      dto.distributionKey === OverheadDistributionKey.QUANTITY
        ? "Paylama: miqdar"
        : "Paylama: material mayası";

    const credit =
      dto.creditAccountCode?.trim() ?? MANUFACTURING_OVERHEAD_CREDIT_ACCOUNT_CODE;
    const debit = dto.debitAccountCode?.trim() ?? "204";
    const source = dto.sourceAccountCode?.trim() ?? credit;

    let allocationsCreated = 0;

    await this.prisma.$transaction(async (tx) => {
      let driver = await tx.overheadDriver.findFirst({
        where: { organizationId, type: driverType, name: driverName },
      });
      if (!driver) {
        driver = await tx.overheadDriver.create({
          data: { organizationId, name: driverName, type: driverType },
        });
      }

      let pool = await tx.overheadPool.findFirst({
        where: { organizationId, period, driverId: driver.id },
        include: { driver: true },
      });
      if (pool) {
        pool = await tx.overheadPool.update({
          where: { id: pool.id },
          data: { totalAmount: new Decimal(dto.totalAmount) },
          include: { driver: true },
        });
      } else {
        pool = await tx.overheadPool.create({
          data: {
            organizationId,
            period,
            totalAmount: new Decimal(dto.totalAmount),
            sourceAccountCode: source,
            creditAccountCode: credit,
            debitAccountCode: debit,
            driverId: driver.id,
          },
          include: { driver: true },
        });
      }

      const releaseIdSet = new Set(dto.releaseIds);
      allocationsCreated += await this.allocatePoolInTransaction(
        tx,
        organizationId,
        pool,
        releases,
        end,
        period,
        releaseIdSet,
      );
    });

    return { period, allocationsCreated };
  }

  /**
   * Idempotent: creates journal + allocation rows only for releases in the month
   * that do not yet have an allocation for this pool. Uses remaining pool budget
   * (totalAmount minus existing allocation amounts) for new slices.
   */
  async allocatePeriod(organizationId: string, period: string) {
    const { year, month } = parsePeriod(period);
    const { start, end } = monthRangeUtc(year, month);

    const pools = await this.prisma.overheadPool.findMany({
      where: { organizationId, period: period.trim() },
      include: { driver: true },
    });
    if (pools.length === 0) {
      return { period: period.trim(), poolsProcessed: 0, allocationsCreated: 0 };
    }

    const releases = await this.prisma.manufacturingRelease.findMany({
      where: {
        organizationId,
        documentDate: { gte: start, lte: end },
      },
    });

    let allocationsCreated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const pool of pools) {
        allocationsCreated += await this.allocatePoolInTransaction(
          tx,
          organizationId,
          pool,
          releases,
          end,
          period.trim(),
        );
      }
    });

    return {
      period: period.trim(),
      poolsProcessed: pools.length,
      allocationsCreated,
    };
  }

  private async allocatePoolInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    pool: OverheadPool & { driver: { name: string; type: OverheadDriverType } },
    releases: ManufacturingRelease[],
    periodEnd: Date,
    periodLabel: string,
    onlyReleaseIds?: Set<string>,
  ): Promise<number> {
    const existing = await tx.overheadAllocation.findMany({
      where: { poolId: pool.id },
    });
    const already = existing.reduce(
      (s, a) => s.add(new Decimal(a.amount)),
      new Decimal(0),
    );
    const remaining = roundMoney2(new Decimal(pool.totalAmount).sub(already));
    if (remaining.lte(0)) return 0;

    const allocatedIds = new Set(existing.map((e) => e.manufacturingReleaseId));
    let candidates = releases.filter((r) => !allocatedIds.has(r.id));
    if (onlyReleaseIds) {
      candidates = candidates.filter((r) => onlyReleaseIds.has(r.id));
    }

    const weights = new Map<string, Decimal>();
    for (const r of candidates) {
      const w = releaseWeight(pool.driver.type, r);
      if (w.gt(0)) weights.set(r.id, w);
    }
    if (weights.size === 0) return 0;

    const amounts = this.splitProportional(remaining, weights);
    if (amounts.size === 0) return 0;

    const lines: Array<{ accountCode: string; debit: string; credit: string }> = [];
    for (const [, amt] of amounts) {
      if (amt.lte(0)) continue;
      lines.push({
        accountCode: pool.debitAccountCode,
        debit: amt.toString(),
        credit: "0",
      });
      lines.push({
        accountCode: pool.creditAccountCode,
        debit: "0",
        credit: amt.toString(),
      });
    }

    if (lines.length === 0) return 0;

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date: periodEnd,
      reference: `OH-${pool.id.slice(0, 8)}`,
      description: `Overhead allocation ${periodLabel} (${pool.driver.name})`,
      isFinal: true,
      lines,
    });

    let created = 0;
    for (const [releaseId, amt] of amounts) {
      if (amt.lte(0)) continue;
      await tx.overheadAllocation.create({
        data: {
          poolId: pool.id,
          manufacturingReleaseId: releaseId,
          amount: amt,
          releaseTransactionId: transactionId,
        },
      });
      created += 1;
    }
    return created;
  }

  private splitProportional(
    total: Decimal,
    weights: Map<string, Decimal>,
  ): Map<string, Decimal> {
    const sumW = [...weights.values()].reduce((a, b) => a.add(b), new Decimal(0));
    const out = new Map<string, Decimal>();
    if (sumW.lte(0)) return out;
    const ids = [...weights.keys()];
    let acc = new Decimal(0);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const w = weights.get(id)!;
      if (i === ids.length - 1) {
        out.set(id, roundMoney2(total.sub(acc)));
      } else {
        const part = roundMoney2(total.mul(w).div(sumW));
        out.set(id, part);
        acc = acc.add(part);
      }
    }
    return out;
  }
}
