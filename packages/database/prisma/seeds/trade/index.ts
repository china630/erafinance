import type { SeedContext } from "../_engine/upsert";
import { seedUnitsOfMeasure } from "./units-of-measure";
import { seedHsCodes } from "./hs-codes";
import { seedCustomsTariffs } from "./customs-tariffs";

export async function seedTrade(ctx: SeedContext): Promise<void> {
  await seedUnitsOfMeasure(ctx);
  await seedHsCodes(ctx);
  await seedCustomsTariffs(ctx);
}
