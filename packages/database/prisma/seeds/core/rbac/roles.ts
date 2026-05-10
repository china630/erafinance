import { UserRole } from "@prisma/client";
import type { SeedContext } from "../../_engine/upsert";
import { ROLES } from "./roles.data";

export async function seedRoles(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of ROLES) {
    await ctx.prisma.role.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        legacyEnumRole:
          row.legacyEnumRole == null
            ? null
            : UserRole[row.legacyEnumRole as keyof typeof UserRole],
        isSystem: true,
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
      },
      update: {
        legacyEnumRole:
          row.legacyEnumRole == null
            ? null
            : UserRole[row.legacyEnumRole as keyof typeof UserRole],
        isSystem: true,
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
      },
    });
  }
}
