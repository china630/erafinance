import { closePrismaPool, createPrismaClient } from "../../../prisma-client";

type CountRow = { count: bigint | number };
function asNumber(v: bigint | number): number {
  return typeof v === "bigint" ? Number(v) : v;
}

async function main() {
  const prisma = createPrismaClient();
  try {
    // Phase-2 for NOT NULL columns: sanitize plaintext to non-PII placeholders,
    // while runtime reads are served from cipher fields via Prisma extension.
    const orgResult = await prisma.$queryRaw<CountRow[]>`
      WITH upd AS (
        UPDATE organizations
        SET tax_id = ('__enc__org__' || REPLACE(id::text, '-', ''))
        WHERE tax_id IS NOT NULL
          AND tax_id_cipher IS NOT NULL
          AND tax_id_blind_index IS NOT NULL
          AND tax_id NOT LIKE '__enc__org__%'
        RETURNING 1
      )
      SELECT COUNT(*)::bigint AS count FROM upd
    `;

    const employeesResult = await prisma.$queryRaw<CountRow[]>`
      WITH upd AS (
        UPDATE employees
        SET fin_code = ('__enc__fin__' || REPLACE(id::text, '-', '')),
            first_name = ('__enc__fn__' || LEFT(REPLACE(id::text, '-', ''), 10)),
            last_name = ('__enc__ln__' || LEFT(REPLACE(id::text, '-', ''), 10))
        WHERE fin_code_cipher IS NOT NULL
          AND fin_code_blind_index IS NOT NULL
          AND first_name_cipher IS NOT NULL
          AND last_name_cipher IS NOT NULL
          AND (
            fin_code NOT LIKE '__enc__fin__%' OR
            first_name NOT LIKE '__enc__fn__%' OR
            last_name NOT LIKE '__enc__ln__%'
          )
        RETURNING 1
      )
      SELECT COUNT(*)::bigint AS count FROM upd
    `;

    const counterpartiesResult = await prisma.$queryRaw<CountRow[]>`
      WITH upd AS (
        UPDATE counterparties
        SET tax_id = ('__enc__cp__' || REPLACE(id::text, '-', '')),
            name = ('__enc__name__' || LEFT(REPLACE(id::text, '-', ''), 10))
        WHERE tax_id_cipher IS NOT NULL
          AND tax_id_blind_index IS NOT NULL
          AND name_cipher IS NOT NULL
          AND (
            tax_id NOT LIKE '__enc__cp__%' OR
            name NOT LIKE '__enc__name__%'
          )
        RETURNING 1
      )
      SELECT COUNT(*)::bigint AS count FROM upd
    `;

    console.info(`[pii-nullify2] organizations_rows=${asNumber(orgResult[0]?.count ?? 0)}`);
    console.info(`[pii-nullify2] employees_rows=${asNumber(employeesResult[0]?.count ?? 0)}`);
    console.info(
      `[pii-nullify2] counterparties_rows=${asNumber(counterpartiesResult[0]?.count ?? 0)}`,
    );
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

main().catch((e) => {
  console.error("[pii-nullify2] failed", e);
  process.exit(1);
});
