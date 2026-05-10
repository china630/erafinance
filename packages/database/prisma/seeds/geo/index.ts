import type { SeedContext } from "../_engine/upsert";
import { seedCountries } from "./countries";
import { seedCities } from "./cities";

export async function seedGeo(ctx: SeedContext): Promise<void> {
  await seedCountries(ctx);
  await seedCities(ctx);
}
