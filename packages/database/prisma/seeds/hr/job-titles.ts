import type { SeedContext } from "../_engine/upsert";
import { JOB_TITLES } from "./job-titles.data";

export async function seedJobTitles(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of JOB_TITLES) {
    await ctx.prisma.jobTitleCatalog.upsert({
      where: { code: row.code },
      create: row,
      update: row,
    });
  }
}
