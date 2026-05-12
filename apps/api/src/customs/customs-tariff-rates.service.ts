import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  pickLatestTariffRatePerHsCode,
  type TariffRateRow,
} from "./customs-tariff-rate-dedupe";

export type { TariffRateRow };
export { pickLatestTariffRatePerHsCode };

export type TariffMatch = {
  hsCode: string;
  dutyRatePercent: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  excisePercent: Prisma.Decimal;
};

@Injectable()
export class CustomsTariffRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async loadActiveRates(asOf: Date): Promise<TariffRateRow[]> {
    const raw = await this.prisma.customsTariffRate.findMany({
      where: {
        deletedAt: null,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      select: {
        hsCode: true,
        effectiveFrom: true,
        dutyRatePercent: true,
        vatRatePercent: true,
        excisePercent: true,
      },
    });
    return pickLatestTariffRatePerHsCode(raw);
  }

  /** Longest-prefix match on normalized HS digits; falls back to `00` row or default 0/18/0. */
  findBestMatchFromRows(rows: TariffRateRow[], hsCodeRaw: string): TariffMatch {
    const itemDigits = hsCodeRaw.replace(/\D/g, "");
    const sorted = [...rows].sort((a, b) => b.hsCode.length - a.hsCode.length);

    for (const r of sorted) {
      if (r.hsCode === "00") continue;
      if (itemDigits.startsWith(r.hsCode)) {
        return {
          hsCode: r.hsCode,
          dutyRatePercent: r.dutyRatePercent,
          vatRatePercent: r.vatRatePercent,
          excisePercent: r.excisePercent,
        };
      }
    }

    const fallback = sorted.find((r) => r.hsCode === "00");
    if (fallback) {
      return {
        hsCode: "00",
        dutyRatePercent: fallback.dutyRatePercent,
        vatRatePercent: fallback.vatRatePercent,
        excisePercent: fallback.excisePercent,
      };
    }

    return {
      hsCode: "default",
      dutyRatePercent: new Prisma.Decimal(0),
      vatRatePercent: new Prisma.Decimal(18),
      excisePercent: new Prisma.Decimal(0),
    };
  }

  async findBestMatch(hsCodeRaw: string, asOf: Date): Promise<TariffMatch> {
    const rows = await this.loadActiveRates(asOf);
    return this.findBestMatchFromRows(rows, hsCodeRaw);
  }

  listForAdmin(includeInactive = false) {
    return this.prisma.customsTariffRate.findMany({
      where: includeInactive ? undefined : { deletedAt: null },
      orderBy: [{ hsCode: "asc" }, { effectiveFrom: "desc" }],
    });
  }

  async upsertRate(params: {
    hsCode: string;
    description?: string | null;
    dutyRatePercent: number;
    vatRatePercent: number;
    excisePercent: number;
    effectiveFrom?: Date;
    notes?: string | null;
  }) {
    const hs = params.hsCode.replace(/\D/g, "").trim();
    if (!hs) throw new NotFoundException("Invalid hsCode");
    const effectiveFrom = params.effectiveFrom ?? new Date("2000-01-01T00:00:00.000Z");
    return this.prisma.customsTariffRate.upsert({
      where: {
        hsCode_effectiveFrom: {
          hsCode: hs,
          effectiveFrom,
        },
      },
      create: {
        hsCode: hs,
        description: params.description ?? null,
        dutyRatePercent: new Prisma.Decimal(params.dutyRatePercent),
        vatRatePercent: new Prisma.Decimal(params.vatRatePercent),
        excisePercent: new Prisma.Decimal(params.excisePercent),
        effectiveFrom,
        notes: params.notes ?? null,
      },
      update: {
        description: params.description ?? null,
        dutyRatePercent: new Prisma.Decimal(params.dutyRatePercent),
        vatRatePercent: new Prisma.Decimal(params.vatRatePercent),
        excisePercent: new Prisma.Decimal(params.excisePercent),
        notes: params.notes ?? null,
        deletedAt: null,
      },
    });
  }

  async softDelete(id: string) {
    const row = await this.prisma.customsTariffRate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Tariff rate not found");
    return this.prisma.customsTariffRate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    const row = await this.prisma.customsTariffRate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Tariff rate not found");
    return this.prisma.customsTariffRate.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
