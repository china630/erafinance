import type { SeedContext } from "../_engine/upsert";
import { upsertByCode } from "../_engine/upsert";

const ACTIVITY_TYPES = [
  { code: "created", nameAz: "Yaradildi", nameRu: "Создано", nameEn: "Created", sortOrder: 0 },
  { code: "updated", nameAz: "Yeniləndi", nameRu: "Изменено", nameEn: "Updated", sortOrder: 1 },
  { code: "commented", nameAz: "Şərh", nameRu: "Комментарий", nameEn: "Commented", sortOrder: 2 },
  { code: "mentioned", nameAz: "Qeyd", nameRu: "Упоминание", nameEn: "Mentioned", sortOrder: 3 },
] as const;

export async function seedActivityTypes(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  await upsertByCode(ctx.prisma.activityType, ACTIVITY_TYPES, (r) => ({ ...r }), (r) => ({ ...r }));
}
