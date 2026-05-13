import { readFile } from "node:fs/promises";
import type { SeedContext } from "../_engine/upsert";
import { CUSTOMS_TARIFF_RATES_CATALOG_PATH } from "./customs-tariffs";

type TariffSeed = {
  hsCode: string;
  description: string;
};

/** Placeholder hook: same HS list as `seedCustomsTariffs` (catalog JSON). Extend when a dedicated `hs_codes` table is seeded. */
export async function seedHsCodes(ctx: SeedContext): Promise<void> {
  const data = JSON.parse(await readFile(CUSTOMS_TARIFF_RATES_CATALOG_PATH, "utf-8")) as TariffSeed[];
  console.info(`[seed:trade] hs catalog loaded ${data.length} rows`);
  if (ctx.dryRun) return;
}
