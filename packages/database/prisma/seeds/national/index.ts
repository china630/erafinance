import type { SeedContext } from "../_engine/upsert";
import { seedNationalChart } from "./chart-of-accounts";
import { seedTaxRates } from "./tax-rates";

export async function seedNational(ctx: SeedContext): Promise<void> {
  if (ctx.region === "AZ") {
    await seedNationalChart(ctx);
    await seedTaxRates(ctx);
    return;
  }
  console.info(`[seed] national region "${ctx.region}" not implemented, skipping`);
}
