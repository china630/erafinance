import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SeedContext } from "../_engine/upsert";

type TariffSeed = {
  hsCode: string;
  description: string;
};

export async function seedHsCodes(ctx: SeedContext): Promise<void> {
  const fp = join(__dirname, "..", "..", "..", "data", "customs-tariff-seed.json");
  const data = JSON.parse(await readFile(fp, "utf-8")) as TariffSeed[];
  console.info(`[seed:trade] hs catalog loaded ${data.length} rows`);
  if (ctx.dryRun) return;
}
