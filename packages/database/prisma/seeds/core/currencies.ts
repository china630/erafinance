import type { SeedContext } from "../_engine/upsert";
import { upsertByCode } from "../_engine/upsert";
import { CURRENCIES } from "./currencies.data";

export async function seedCurrencies(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) {
    console.info(`[seed:core] currencies dry-run rows=${CURRENCIES.length}`);
    return;
  }
  await upsertByCode(
    ctx.prisma.currency,
    CURRENCIES,
    (r) => ({ ...r, isActive: true }),
    (r) => ({ ...r, isActive: true }),
  );
}
