import type { SeedContext } from "../_engine/upsert";
import { seedDepartmentTypes } from "./department-types";
import { seedJobTitles } from "./job-titles";

export async function seedHr(ctx: SeedContext): Promise<void> {
  await seedDepartmentTypes(ctx);
  await seedJobTitles(ctx);
}
