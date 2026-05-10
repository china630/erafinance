import { OrganizationKind } from "@prisma/client";
import type { SeedContext } from "../_engine/upsert";
import {
  loadChartJson,
  seedChartOfAccountsCatalogEntries,
  upsertGlobalNasTemplateAccounts,
} from "../../lib/chart/chart-seed";

export async function seedNationalChart(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const kind of [
    OrganizationKind.COMMERCIAL,
    OrganizationKind.BUDGET,
    OrganizationKind.NGO,
  ]) {
    const accounts = await loadChartJson(kind);
    await seedChartOfAccountsCatalogEntries(ctx.prisma, accounts, kind);
  }
  await upsertGlobalNasTemplateAccounts(ctx.prisma);
}
