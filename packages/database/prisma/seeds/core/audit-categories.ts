import type { SeedContext } from "../_engine/upsert";

const AUDIT_CATEGORIES = [
  { code: "auth", nameAz: "Auth", nameRu: "Аутентификация", nameEn: "Authentication", sortOrder: 0 },
  { code: "billing", nameAz: "Billing", nameRu: "Биллинг", nameEn: "Billing", sortOrder: 1 },
  { code: "accounting", nameAz: "Mühasibat", nameRu: "Бухгалтерия", nameEn: "Accounting", sortOrder: 2 },
  { code: "inventory", nameAz: "Anbar", nameRu: "Склад", nameEn: "Inventory", sortOrder: 3 },
] as const;

export async function seedAuditCategories(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of AUDIT_CATEGORIES) {
    await ctx.prisma.auditCategory.upsert({
      where: { code: row.code },
      create: { ...row, isActive: true },
      update: { ...row, isActive: true },
    });
  }
}
