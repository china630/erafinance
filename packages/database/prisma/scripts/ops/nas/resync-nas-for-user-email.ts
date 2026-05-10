/**
 * Re-provisions NAS `accounts` for all organizations visible to a user from `template_accounts`
 * / catalog (`provisionNasAccountsForOrganization`).
 *
 * Repo root (with DATABASE_URL in .env):
 *   npx dotenv-cli -e .env -- npx tsx packages/database/prisma/scripts/ops/nas/resync-nas-for-user-email.ts user@example.com
 */
import type { OrganizationKind } from "@prisma/client";
import { provisionNasAccountsForOrganization } from "../../../lib/chart/chart-seed";
import { closePrismaPool, createPrismaClient } from "../../../prisma-client";

const prisma = createPrismaClient();

function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function main() {
  const arg = process.argv[2] ?? process.env.TARGET_USER_EMAIL;
  if (!arg) {
    process.stderr.write(
      "Usage: npx tsx packages/database/prisma/scripts/ops/nas/resync-nas-for-user-email.ts <email>\n",
    );
    process.exit(1);
  }
  const email = normEmail(arg);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    process.stderr.write(`User not found: ${email}\n`);
    process.exit(1);
  }

  const owned = await prisma.organization.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true, kind: true },
  });

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: user.id },
    select: {
      organization: {
        select: { id: true, name: true, kind: true },
      },
    },
  });

  const byId = new Map<string, { id: string; name: string; kind: OrganizationKind }>();
  for (const o of owned) {
    byId.set(o.id, { id: o.id, name: o.name, kind: o.kind });
  }
  for (const m of memberships) {
    const o = m.organization;
    if (!byId.has(o.id)) {
      byId.set(o.id, { id: o.id, name: o.name, kind: o.kind });
    }
  }

  const orgs = [...byId.values()];
  if (orgs.length === 0) {
    process.stdout.write(`No organizations for user ${user.email}\n`);
    return;
  }

  process.stdout.write(
    `User ${user.email}: ${orgs.length} org(s) — re-provisioning NAS from template…\n`,
  );

  for (const o of orgs) {
    process.stdout.write(`  • ${o.name} (${o.id}) kind=${o.kind} … `);
    await provisionNasAccountsForOrganization(prisma, o.id, o.kind);
    process.stdout.write("ok\n");
  }

  process.stdout.write("Done.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closePrismaPool();
  });
