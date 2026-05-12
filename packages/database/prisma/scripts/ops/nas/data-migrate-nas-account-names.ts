/**
 * Data migration: refresh NAS ledger account names from `chart_of_accounts_entries`
 * matched by organization `kind` + account `code`.
 *
 * Run from repo root (with DATABASE_URL):
 *   npm run db:migrate:nas-names --workspace=@erafinance/database
 */
import { LedgerType, OrganizationKind } from "@prisma/client";
import { closePrismaPool, createPrismaClient } from "../../../prisma-client";

const prisma = createPrismaClient();

async function main() {
  const catalogs = await prisma.chartOfAccountsEntry.findMany({
    where: { isDeprecated: false },
    select: { kind: true, code: true, nameAz: true, nameRu: true, nameEn: true },
  });
  const byKindCode = new Map<string, { nameAz: string; nameRu: string; nameEn: string }>();
  for (const c of catalogs) {
    byKindCode.set(`${c.kind}::${c.code}`, c);
  }
  if (byKindCode.size === 0) {
    console.warn(
      "[data-migrate-nas-names] chart_of_accounts_entries is empty — run prisma db seed first.",
    );
    return;
  }

  const accounts = await prisma.account.findMany({
    where: { ledgerType: LedgerType.NAS },
    select: { id: true, code: true, organizationId: true },
  });

  const orgKinds = await prisma.organization.findMany({
    select: { id: true, kind: true },
  });
  const kindByOrg = new Map(orgKinds.map((o) => [o.id, o.kind]));

  let updated = 0;
  let skipped = 0;
  for (const a of accounts) {
    const kind = kindByOrg.get(a.organizationId) ?? OrganizationKind.COMMERCIAL;
    const row = byKindCode.get(`${kind}::${a.code}`);
    if (!row) {
      skipped += 1;
      continue;
    }
    await prisma.account.update({
      where: { id: a.id },
      data: {
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
      },
    });
    updated += 1;
  }

  console.info(
    `[data-migrate-nas-names] updated=${updated}, skipped(no catalog match)=${skipped}`,
  );
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
