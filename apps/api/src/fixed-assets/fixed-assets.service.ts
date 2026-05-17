import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FixedAssetDepreciationMethod,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";
import { UpdateFixedAssetDto } from "./dto/update-fixed-asset.dto";
import { DepreciationService } from "./depreciation.service";

const Decimal = Prisma.Decimal;

@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depreciation: DepreciationService,
  ) {}

  list(organizationId: string) {
    return this.prisma.fixedAsset.findMany({
      where: { organizationId },
      orderBy: [{ inventoryNumber: "asc" }],
    });
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.fixedAsset.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Fixed asset not found");
    return row;
  }

  async create(organizationId: string, dto: CreateFixedAssetDto) {
    const purchaseDateRaw = dto.purchaseDate ?? dto.commissioningDate;
    const purchasePriceRaw = dto.purchasePrice ?? dto.initialCost;
    if (!purchaseDateRaw) {
      throw new BadRequestException("purchaseDate is required");
    }
    if (purchasePriceRaw == null) {
      throw new BadRequestException("purchasePrice is required");
    }
    const salvage = new Decimal(dto.salvageValue ?? 0);
    const initial = new Decimal(purchasePriceRaw);
    if (salvage.gte(initial)) {
      throw new ConflictException("salvageValue must be less than purchasePrice");
    }
    const depreciationMethod =
      dto.depreciationMethod ?? FixedAssetDepreciationMethod.STRAIGHT_LINE;
    const totalExpectedUnits =
      dto.totalExpectedUnits != null ? new Decimal(dto.totalExpectedUnits) : null;
    const decliningBalanceRate =
      dto.decliningBalanceRate != null ? new Decimal(dto.decliningBalanceRate) : null;
    this.assertDepreciationFieldConsistency({
      depreciationMethod,
      totalExpectedUnits,
      decliningBalanceRate,
    });
    try {
      return await this.prisma.fixedAsset.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          inventoryNumber: dto.inventoryNumber.trim(),
          purchaseDate: new Date(purchaseDateRaw),
          purchasePrice: initial,
          usefulLifeMonths: dto.usefulLifeMonths,
          salvageValue: salvage,
          status: dto.status,
          depreciationMethod,
          totalExpectedUnits: totalExpectedUnits ?? undefined,
          decliningBalanceRate: decliningBalanceRate ?? undefined,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Инвентарный номер уже занят");
      }
      throw e;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateFixedAssetDto) {
    const existing = await this.getOne(organizationId, id);
    const data: Record<string, unknown> = {};
    if (dto.name != null) data.name = dto.name.trim();
    if (dto.inventoryNumber != null) data.inventoryNumber = dto.inventoryNumber.trim();
    const purchaseDateRaw = dto.purchaseDate ?? dto.commissioningDate;
    if (purchaseDateRaw != null) {
      data.purchaseDate = new Date(purchaseDateRaw);
    }
    const purchasePriceRaw = dto.purchasePrice ?? dto.initialCost;
    if (purchasePriceRaw != null) data.purchasePrice = new Decimal(purchasePriceRaw);
    if (dto.usefulLifeMonths != null) data.usefulLifeMonths = dto.usefulLifeMonths;
    if (dto.salvageValue != null) data.salvageValue = new Decimal(dto.salvageValue);
    if (dto.status != null) data.status = dto.status;
    if (dto.depreciationMethod != null) data.depreciationMethod = dto.depreciationMethod;
    if (dto.totalExpectedUnits != null) {
      data.totalExpectedUnits = new Decimal(dto.totalExpectedUnits);
    }
    if (dto.decliningBalanceRate != null) {
      data.decliningBalanceRate = new Decimal(dto.decliningBalanceRate);
    }

    const mergedMethod =
      dto.depreciationMethod ?? existing.depreciationMethod;
    const mergedTotal =
      dto.totalExpectedUnits != null
        ? new Decimal(dto.totalExpectedUnits)
        : existing.totalExpectedUnits;
    const mergedDeclining =
      dto.decliningBalanceRate != null
        ? new Decimal(dto.decliningBalanceRate)
        : existing.decliningBalanceRate;

    this.assertDepreciationFieldConsistency({
      depreciationMethod: mergedMethod,
      totalExpectedUnits: mergedTotal,
      decliningBalanceRate: mergedDeclining,
    });

    const nextPurchase =
      purchasePriceRaw != null
        ? new Decimal(purchasePriceRaw)
        : new Decimal(existing.purchasePrice);
    const nextSalvage =
      dto.salvageValue != null
        ? new Decimal(dto.salvageValue)
        : new Decimal(existing.salvageValue);
    if (nextSalvage.gte(nextPurchase)) {
      throw new ConflictException("salvageValue must be less than purchasePrice");
    }

    try {
      return await this.prisma.fixedAsset.update({
        where: { id },
        data,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Инвентарный номер уже занят");
      }
      throw e;
    }
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    try {
      await this.prisma.fixedAsset.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new ConflictException("Нельзя удалить: есть начисления амортизации");
      }
      throw e;
    }
  }

  async runMonthlyDepreciation(
    organizationId: string,
    period: { year: number; month: number },
  ) {
    if (period.year < 1900 || period.year > 2100) {
      throw new ConflictException("year must be in range 1900-2100");
    }
    if (period.month < 1 || period.month > 12) {
      throw new ConflictException("month must be in range 1-12");
    }
    return this.prisma.$transaction((tx) =>
      this.depreciation.runMonthlyDepreciation(
        tx,
        organizationId,
        period.year,
        period.month,
      ),
    );
  }

  async recordUsage(organizationId: string, assetId: string, periodUnits: number) {
    return this.prisma.$transaction((tx) =>
      this.depreciation.recordUnitsOfProductionUsage(
        tx,
        organizationId,
        assetId,
        periodUnits,
      ),
    );
  }

  async listMonthlyUsage(organizationId: string, year: number, month: number) {
    if (month < 1 || month > 12) {
      throw new BadRequestException("month must be in range 1-12");
    }
    const [assets, usages] = await Promise.all([
      this.prisma.fixedAsset.findMany({
        where: {
          organizationId,
          depreciationMethod: FixedAssetDepreciationMethod.UNITS_OF_PRODUCTION,
          status: "ACTIVE",
        },
        orderBy: [{ inventoryNumber: "asc" }],
      }),
      this.prisma.fixedAssetMonthlyUsage.findMany({
        where: { organizationId, year, month },
      }),
    ]);
    const usageByAsset = new Map(usages.map((u) => [u.fixedAssetId, u]));
    return {
      year,
      month,
      items: assets.map((a) => {
        const u = usageByAsset.get(a.id);
        return {
          fixedAssetId: a.id,
          name: a.name,
          inventoryNumber: a.inventoryNumber,
          totalExpectedUnits: a.totalExpectedUnits,
          unitsProducedTotal: a.unitsProducedTotal,
          periodUnits: u ? Number(u.periodUnits) : null,
          usageId: u?.id ?? null,
        };
      }),
    };
  }

  async upsertMonthlyUsage(
    organizationId: string,
    assetId: string,
    params: { year: number; month: number; periodUnits: number },
  ) {
    const asset = await this.getOne(organizationId, assetId);
    if (asset.depreciationMethod !== FixedAssetDepreciationMethod.UNITS_OF_PRODUCTION) {
      throw new BadRequestException(
        "Monthly usage is only for UNITS_OF_PRODUCTION assets",
      );
    }
    if (params.periodUnits <= 0) {
      throw new BadRequestException("periodUnits must be positive");
    }
    const depExists = await this.prisma.fixedAssetDepreciationMonth.findUnique({
      where: {
        fixedAssetId_year_month: {
          fixedAssetId: assetId,
          year: params.year,
          month: params.month,
        },
      },
    });
    if (depExists) {
      throw new ConflictException(
        "Depreciation already posted for this asset and month",
      );
    }
    return this.prisma.fixedAssetMonthlyUsage.upsert({
      where: {
        fixedAssetId_year_month: {
          fixedAssetId: assetId,
          year: params.year,
          month: params.month,
        },
      },
      create: {
        organizationId,
        fixedAssetId: assetId,
        year: params.year,
        month: params.month,
        periodUnits: new Decimal(params.periodUnits),
      },
      update: {
        periodUnits: new Decimal(params.periodUnits),
      },
    });
  }

  async bulkUpsertMonthlyUsage(
    organizationId: string,
    params: {
      year: number;
      month: number;
      entries: Array<{ fixedAssetId: string; periodUnits: number }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const e of params.entries) {
        const asset = await tx.fixedAsset.findFirst({
          where: { id: e.fixedAssetId, organizationId },
        });
        if (!asset) {
          throw new NotFoundException(`Fixed asset ${e.fixedAssetId} not found`);
        }
        if (asset.depreciationMethod !== FixedAssetDepreciationMethod.UNITS_OF_PRODUCTION) {
          throw new BadRequestException(
            `Asset ${e.fixedAssetId} is not UNITS_OF_PRODUCTION`,
          );
        }
        const depExists = await tx.fixedAssetDepreciationMonth.findUnique({
          where: {
            fixedAssetId_year_month: {
              fixedAssetId: e.fixedAssetId,
              year: params.year,
              month: params.month,
            },
          },
        });
        if (depExists) continue;

        const row = await tx.fixedAssetMonthlyUsage.upsert({
          where: {
            fixedAssetId_year_month: {
              fixedAssetId: e.fixedAssetId,
              year: params.year,
              month: params.month,
            },
          },
          create: {
            organizationId,
            fixedAssetId: e.fixedAssetId,
            year: params.year,
            month: params.month,
            periodUnits: new Decimal(e.periodUnits),
          },
          update: { periodUnits: new Decimal(e.periodUnits) },
        });
        results.push(row);
      }
      return { year: params.year, month: params.month, saved: results.length };
    });
  }

  private assertDepreciationFieldConsistency(params: {
    depreciationMethod: FixedAssetDepreciationMethod;
    totalExpectedUnits: Prisma.Decimal | null;
    decliningBalanceRate: Prisma.Decimal | null;
  }): void {
    if (params.depreciationMethod === FixedAssetDepreciationMethod.UNITS_OF_PRODUCTION) {
      if (!params.totalExpectedUnits || params.totalExpectedUnits.lte(0)) {
        throw new BadRequestException(
          "totalExpectedUnits is required and must be positive for UNITS_OF_PRODUCTION",
        );
      }
    }
    if (params.depreciationMethod === FixedAssetDepreciationMethod.REDUCING_BALANCE) {
      if (!params.decliningBalanceRate || params.decliningBalanceRate.lte(0)) {
        throw new BadRequestException(
          "decliningBalanceRate is required and must be positive for REDUCING_BALANCE",
        );
      }
      if (params.decliningBalanceRate.gt(1)) {
        throw new BadRequestException("decliningBalanceRate must be at most 1");
      }
    }
  }
}
