import type { PrismaClient } from "@prisma/client";
import { LANDING_MODULE_MARKETING_DEFAULTS } from "./landing-modules";

export async function seedLandingModuleMarketing(
  prisma: PrismaClient,
): Promise<void> {
  for (const row of LANDING_MODULE_MARKETING_DEFAULTS) {
    await prisma.landingModuleMarketing.upsert({
      where: { moduleSlug: row.moduleSlug },
      create: {
        moduleSlug: row.moduleSlug,
        sortOrder: row.sortOrder,
        names: row.names,
        descriptions: row.descriptions,
        tasks: row.tasks,
      },
      update: {
        sortOrder: row.sortOrder,
        names: row.names,
        descriptions: row.descriptions,
        tasks: row.tasks,
      },
    });
  }
}
