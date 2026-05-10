import { closePrismaPool, createPrismaClient } from "../../../prisma-client";

type CurrencyColumn = {
  table: string;
  column: string;
};

const CURRENCY_COLUMNS: CurrencyColumn[] = [
  { table: "organizations", column: "currency" },
  { table: "organization_bank_accounts", column: "currency" },
  { table: "payment_orders", column: "currency" },
  { table: "bank_payment_drafts", column: "currency" },
  { table: "approval_policies", column: "currency" },
  { table: "prepaid_expenses", column: "currency" },
  { table: "psa_projects", column: "currency" },
  { table: "accounts", column: "currency" },
  { table: "counterparty_bank_accounts", column: "currency" },
  { table: "invoices", column: "currency" },
  { table: "customs_declarations", column: "currency" },
  { table: "cash_orders", column: "currency" },
  { table: "holdings", column: "base_currency" },
];

async function ensureAznCatalogRow(prisma: ReturnType<typeof createPrismaClient>): Promise<void> {
  await prisma.currency.upsert({
    where: { code: "AZN" },
    create: {
      code: "AZN",
      symbol: "₼",
      decimals: 2,
      nameAz: "Azərbaycan manatı",
      nameRu: "Азербайджанский манат",
      nameEn: "Azerbaijani manat",
      isActive: true,
      sortOrder: 0,
    },
    update: {},
  });
}

async function scanCurrencyColumns(prisma: ReturnType<typeof createPrismaClient>): Promise<{
  unknown: Map<string, number>;
  blankTotal: number;
}> {
  const known = new Set(
    (await prisma.currency.findMany({ select: { code: true } })).map((x) => x.code),
  );
  const unknown = new Map<string, number>();
  let blankTotal = 0;

  for (const { table, column } of CURRENCY_COLUMNS) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "${column}"::text AS code, COUNT(*)::int AS count FROM "${table}" GROUP BY "${column}"`,
    )) as Array<{ code: string | null; count: number }>;

    for (const row of rows) {
      const raw = row.code;
      if (raw == null || raw.trim() === "") {
        blankTotal += Number(row.count ?? 0);
        continue;
      }
      const code = raw.trim().toUpperCase();
      if (known.has(code)) continue;
      unknown.set(code, (unknown.get(code) ?? 0) + Number(row.count ?? 0));
    }
  }

  return { unknown, blankTotal };
}

async function main() {
  const prisma = createPrismaClient();
  const allowUnknowns = process.argv.includes("--allow-unknowns");
  const normalizeToAzn = process.argv.includes("--normalize-invalid-to-azn");
  const seedMissing = process.argv.includes("--seed-missing");

  try {
    let { unknown, blankTotal } = await scanCurrencyColumns(prisma);

    if (unknown.size > 0 && seedMissing) {
      let sortBase = (await prisma.currency.count()) + 100;
      const seededCodes = [...unknown.keys()].sort((a, b) => a.localeCompare(b));
      for (const code of seededCodes) {
        await prisma.currency.upsert({
          where: { code },
          create: {
            code,
            symbol: code,
            decimals: 2,
            nameAz: code,
            nameRu: code,
            nameEn: code,
            isActive: true,
            sortOrder: sortBase++,
          },
          update: {},
        });
      }
      console.info(`[audit-currency-codes] --seed-missing: upserted ${seededCodes.length} currency row(s)`);
      ({ unknown, blankTotal } = await scanCurrencyColumns(prisma));
    }

    if (normalizeToAzn) {
      await ensureAznCatalogRow(prisma);
      for (const { table, column } of CURRENCY_COLUMNS) {
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" AS t SET "${column}" = 'AZN' WHERE t."${column}" IS NULL OR trim(t."${column}"::text) = '' OR NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."${column}")`,
        );
      }
      console.info(
        "[audit-currency-codes] --normalize-invalid-to-azn: normalized blank/invalid currency columns to AZN",
      );
      ({ unknown, blankTotal } = await scanCurrencyColumns(prisma));
    }

    if (unknown.size === 0 && blankTotal === 0) {
      console.info("[audit-currency-codes] OK: all currency codes are present in currencies(code)");
      return;
    }

    if (blankTotal > 0) {
      console.error(`[audit-currency-codes] Blank or null currency values: ${blankTotal} row(s) total`);
    }
    if (unknown.size > 0) {
      console.error("[audit-currency-codes] Unknown currency codes detected:");
      for (const [code, count] of [...unknown.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.error(`  - ${code}: ${count}`);
      }
    }

    if (!allowUnknowns) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

void main();
