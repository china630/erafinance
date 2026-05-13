import type { SeedContext } from "../_engine/upsert";
import { upsertPlatformSuperAdmins } from "../../lib/platform/upsert-platform-super-admins";

/**
 * Platform super-admins: `lib/platform/upsert-platform-super-admins`.
 * Demo seed (`SEED_DEMO_ORG=1`, e.g. `db:seed:demo` / LOCAL-SEED) resets passwords so login matches
 * `PLATFORM_SUPER_ADMIN_DEFAULT_PASSWORD` even if `local-mock-seed` created the same email first with a different hash.
 */
export async function seedPlatformSuperAdmins(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  const mode =
    process.env.SEED_DEMO_ORG === "1" ? "reset_password" : "preserve_password";
  await upsertPlatformSuperAdmins(ctx.prisma, mode);
}
