import type { SeedContext } from "../_engine/upsert";
import { DEPARTMENT_TYPES } from "./department-types.data";

export async function seedDepartmentTypes(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of DEPARTMENT_TYPES) {
    await ctx.prisma.departmentTypeCatalog.upsert({
      where: { code: row.code },
      create: row,
      update: row,
    });
  }
}
