import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

/** Platform super-admin emails (JWT `isSuperAdmin`, `/api/admin`). */
export const PLATFORM_SUPER_ADMIN_EMAILS = [
  "inaram84@gmail.com",
  "shirinov.chingiz@gmail.com",
] as const;

export const PLATFORM_SUPER_ADMIN_DEFAULT_PASSWORD = "12345678";

const BCRYPT_ROUNDS = 10;

export type UpsertPlatformSuperAdminsMode = "preserve_password" | "reset_password";

/**
 * Ensures listed users exist with `isSuperAdmin: true`.
 * - `preserve_password`: do not change `password_hash` on update (only ensure `isSuperAdmin`).
 * - `reset_password`: sets password to `PLATFORM_SUPER_ADMIN_DEFAULT_PASSWORD` on every upsert (prod-init style).
 */
export async function upsertPlatformSuperAdmins(
  prisma: PrismaClient,
  mode: UpsertPlatformSuperAdminsMode,
): Promise<void> {
  const hash = await bcrypt.hash(PLATFORM_SUPER_ADMIN_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  for (const emailRaw of PLATFORM_SUPER_ADMIN_EMAILS) {
    const email = emailRaw.toLowerCase().trim();
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: hash,
        isSuperAdmin: true,
      },
      update: {
        isSuperAdmin: true,
        ...(mode === "reset_password" ? { passwordHash: hash } : {}),
      },
    });
  }
}
