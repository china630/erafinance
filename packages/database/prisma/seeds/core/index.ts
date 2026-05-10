import type { SeedContext } from "../_engine/upsert";
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

export async function seedCore(ctx: SeedContext): Promise<void> {
  if (!ctx.dryRun) {
    await seedPricingModuleIfEmpty(ctx.prisma);
  }
  await seedCurrencies(ctx);
  await seedPermissions(ctx);
  await seedRoles(ctx);
  await seedRolePermissions(ctx);
  await seedSystemUsers(ctx);
  await seedActivityTypes(ctx);
  await seedNotificationTypes(ctx);
  await seedAuditCategories(ctx);
  if (!ctx.only || ctx.only === "system-product-templates") {
    await seedSystemProductTemplates(ctx);
  }
}

