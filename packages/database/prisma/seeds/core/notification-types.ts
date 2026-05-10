import { NotificationSeverity } from "@prisma/client";
import type { SeedContext } from "../_engine/upsert";

const NOTIFICATION_TYPES = [
  { code: "invoice.overdue", defaultSeverity: NotificationSeverity.WARNING, nameAz: "Gecikmiş faktura", nameRu: "Просроченный инвойс", nameEn: "Invoice overdue", sortOrder: 0 },
  { code: "payroll.run.posted", defaultSeverity: NotificationSeverity.INFO, nameAz: "Maaş keçirildi", nameRu: "Зарплата проведена", nameEn: "Payroll posted", sortOrder: 1 },
  { code: "integration.sync.failed", defaultSeverity: NotificationSeverity.CRITICAL, nameAz: "İnteqrasiya xətası", nameRu: "Ошибка интеграции", nameEn: "Integration failed", sortOrder: 2 },
] as const;

export async function seedNotificationTypes(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of NOTIFICATION_TYPES) {
    await ctx.prisma.notificationType.upsert({
      where: { code: row.code },
      create: row,
      update: row,
    });
  }
}
