/**
 * Prints `password_hash` for a user (optional ops/debug). Default seed uses bcrypt at runtime in
 * `lib/platform/upsert-platform-super-admins.ts` — no committed SQL hash file.
 *
 * From repo root: dotenv -e .env -- npm run docker-init:super-admin-hash -w @erafinance/database
 *
 * Env: SUPER_ADMIN_EMAIL (default shirinov.chingiz@gmail.com).
 */
import { closePrismaPool, createPrismaClient } from "../prisma-client";

const email =
  process.env.SUPER_ADMIN_EMAIL?.trim() || "shirinov.chingiz@gmail.com";

const prisma = createPrismaClient();

async function main(): Promise<void> {
  const row = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });
  if (!row?.passwordHash) {
    process.stderr.write(
      `No user with email ${email} — register once locally, then re-run.\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(row.passwordHash + "\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closePrismaPool();
  });
