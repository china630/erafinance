import type { SeedContext } from "../_engine/upsert";
import { seedLandingModuleMarketing } from "../../lib/config/landing-modules-seed";
import { seedTrial3MonthsBundle } from "../../lib/config/trial-bundle-seed";
import { seedPricingBundleDefaultsIfEmpty } from "../../lib/core/pricing-bundle-seed";
import { seedPricingModuleIfEmpty } from "../../lib/core/pricing-module-seed";
import { seedCurrencies } from "./currencies";
import { seedPermissions } from "./rbac/permissions";
import { seedRoles } from "./rbac/roles";
import { seedRolePermissions } from "./rbac/role-permissions";
import { seedSystemUsers } from "./system-users";
import { seedActivityTypes } from "./activity-types";
import { seedNotificationTypes } from "./notification-types";
import { seedAuditCategories } from "./audit-categories";
import { seedSystemProductTemplates } from "./system-product-templates";
import { seedPlatformSuperAdmins } from "./platform-super-admins";

export async function seedCore(ctx: SeedContext): Promise<void> {
  if (!ctx.dryRun) {
    await seedPricingModuleIfEmpty(ctx.prisma);
    await seedPricingBundleDefaultsIfEmpty(ctx.prisma);
    await seedTrial3MonthsBundle(ctx.prisma);
    await seedLandingModuleMarketing(ctx.prisma);
  }
  await seedCurrencies(ctx);
  await seedPermissions(ctx);
  await seedRoles(ctx);
  await seedRolePermissions(ctx);
  await seedSystemUsers(ctx);
  await seedPlatformSuperAdmins(ctx);
  await seedActivityTypes(ctx);
  await seedNotificationTypes(ctx);
  await seedAuditCategories(ctx);
  if (!ctx.only || ctx.only === "system-product-templates") {
    await seedSystemProductTemplates(ctx);
  }
}

