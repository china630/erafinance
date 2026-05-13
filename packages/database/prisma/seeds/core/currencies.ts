import type { SeedContext } from "../_engine/upsert";
import { ensurePlatformCurrenciesSeeded } from "../../lib/core/ensure-currencies-seed";
import { CURRENCIES } from "./currencies.data";

export async function seedCurrencies(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) {
    console.info(`[seed:core] currencies dry-run rows=${CURRENCIES.length}`);
    return;
  }
  await ensurePlatformCurrenciesSeeded(ctx.prisma);
}
