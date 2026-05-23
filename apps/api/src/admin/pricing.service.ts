import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  seedPricingBundleDefaultsIfEmpty,
  seedPricingModuleIfEmpty,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { DEFAULT_PREMIUM_MODULE_SLUGS } from "../billing/tariff-limits";

/**
 * Каталог модулей: источник правды — таблица `pricing_modules` (v12.4).
 * При пустой таблице выполняется то же первичное наполнение, что и в `prisma db seed`
 * (`seedPricingModuleIfEmpty` в @erafinance/database).
 */
export type ConstructorModuleRow = {
  id: string;
  key: string;
  name: string;
  /** Дублирует pricePerMonth для API/ТЗ */
  priceMonthly: number;
  pricePerMonth: number;
  sortOrder: number;
  isPremium: boolean;
};

@Injectable()
export class PricingService implements OnModuleInit {
  private premiumModuleKeys = new Set<string>(DEFAULT_PREMIUM_MODULE_SLUGS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshPremiumModuleKeys();
  }

  /** Reload premium slugs from DB (after Super-Admin catalog save). */
  async refreshPremiumModuleKeys(): Promise<void> {
    await this.ensurePricingModulesFromDatabase();
    const rows = await this.prisma.pricingModule.findMany({
      where: { isPremium: true },
      select: { key: true },
    });
    this.premiumModuleKeys = new Set(
      rows.length > 0 ? rows.map((r) => r.key) : [...DEFAULT_PREMIUM_MODULE_SLUGS],
    );
  }

  isPremiumModuleKey(key: string): boolean {
    return this.premiumModuleKeys.has(key);
  }

  getPremiumModuleKeys(): readonly string[] {
    return [...this.premiumModuleKeys].sort();
  }

  /**
   * Пустая `pricing_modules` → `seedPricingModuleIfEmpty`; иначе только БД (v12.7).
   */
  async ensurePricingModulesFromDatabase(): Promise<void> {
    await seedPricingModuleIfEmpty(this.prisma);
  }

  /**
   * Базовая цена (SystemConfig) и модули из `pricing_modules`.
   */
  async getConstructorData(): Promise<{
    basePrice: number;
    modules: ConstructorModuleRow[];
  }> {
    await this.ensurePricingModulesFromDatabase();
    await seedPricingBundleDefaultsIfEmpty(this.prisma);
    const [basePrice, rows] = await Promise.all([
      this.systemConfig.getFoundationMonthlyAzn(),
      this.prisma.pricingModule.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    const modules: ConstructorModuleRow[] = rows.map((r) => {
      const pm = Number(r.pricePerMonth);
      return {
        id: r.id,
        key: r.key,
        name: r.name,
        priceMonthly: pm,
        pricePerMonth: pm,
        sortOrder: r.sortOrder,
        isPremium: r.isPremium,
      };
    });
    await this.refreshPremiumModuleKeys();
    return { basePrice, modules };
  }

  /**
   * Полный сброс каталога модулей к дефолтам (Super-Admin «Pelsi sıfırla»).
   */
  async resetPricingCatalogToDefaults(): Promise<ConstructorModuleRow[]> {
    await this.prisma.pricingModule.deleteMany({});
    await this.ensurePricingModulesFromDatabase();
    await this.refreshPremiumModuleKeys();
    const rows = await this.prisma.pricingModule.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => {
      const pm = Number(r.pricePerMonth);
      return {
        id: r.id,
        key: r.key,
        name: r.name,
        priceMonthly: pm,
        pricePerMonth: pm,
        sortOrder: r.sortOrder,
        isPremium: r.isPremium,
      };
    });
  }
}
