import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Decimal,
  OverheadDriverType,
  type ManufacturingRelease,
} from "@dayday/database";
import { AccountingService } from "../accounting/accounting.service";
import { PrismaService } from "../prisma/prisma.service";
import { monthRangeUtc } from "../reporting/reporting-period.util";
import { roundMoney2 } from "../fixed-assets/decimal-round";
import { CreateOverheadDriverDto } from "./dto/create-overhead-driver.dto";
import { CreateOverheadPoolDto } from "./dto/create-overhead-pool.dto";
import { UpdateOverheadDriverDto } from "./dto/update-overhead-driver.dto";

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
        const existing = await tx.overheadAllocation.findMany({
          where: { poolId: pool.id },
        });
        const already = existing.reduce(
          (s, a) => s.add(new Decimal(a.amount)),
          new Decimal(0),
        );
        const remaining = roundMoney2(new Decimal(pool.totalAmount).sub(already));
        if (remaining.lte(0)) continue;

        const allocatedIds = new Set(existing.map((e) => e.manufacturingReleaseId));
        const candidates = releases.filter((r) => !allocatedIds.has(r.id));

        const weights = new Map<string, Decimal>();
        for (const r of candidates) {
          const w = releaseWeight(pool.driver.type, r);
          if (w.gt(0)) weights.set(r.id, w);
        }
        if (weights.size === 0) continue;

        const amounts = this.splitProportional(remaining, weights);
        if (amounts.size === 0) continue;

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

        if (lines.length === 0) continue;

        const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
          organizationId,
          date: end,
          reference: `OH-${pool.id.slice(0, 8)}`,
          description: `Overhead allocation ${period} (${pool.driver.name})`,
          isFinal: true,
          lines,
        });

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
          allocationsCreated += 1;
        }
      }
    });

    return {
      period: period.trim(),
      poolsProcessed: pools.length,
      allocationsCreated,
    };
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
