import { closePrismaPool, createPrismaClient } from "../../../prisma-client";

type CountRow = { count: bigint | number };

function asNumber(v: bigint | number): number {
  return typeof v === "bigint" ? Number(v) : v;
}

async function scalarCount(sql: Promise<CountRow[]>): Promise<number> {
  const rows = await sql;
  return asNumber(rows[0]?.count ?? 0);
}

async function main() {
  const prisma = createPrismaClient();
  try {
    const checks = {
      organizationsMissing: await scalarCount(
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM organizations WHERE tax_id_cipher IS NULL OR tax_id_blind_index IS NULL`,
      ),
      employeesMissing: await scalarCount(
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM employees WHERE fin_code_cipher IS NULL OR fin_code_blind_index IS NULL OR first_name_cipher IS NULL OR last_name_cipher IS NULL`,
      ),
      counterpartiesMissing: await scalarCount(
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM counterparties WHERE tax_id_cipher IS NULL OR tax_id_blind_index IS NULL OR name_cipher IS NULL`,
      ),
      usersMissing: await scalarCount(
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM users WHERE first_name_cipher IS NULL OR last_name_cipher IS NULL`,
      ),
    };

    console.info("[pii-cutover] readiness report:");
    for (const [k, v] of Object.entries(checks)) {
      console.info(`[pii-cutover]   ${k}=${v}`);
    }

    const notReady = Object.values(checks).some((v) => v > 0);
    if (notReady) {
      console.error("[pii-cutover] NOT READY: unresolved NULL encrypted/blind fields");
      process.exit(1);
    }
    console.info("[pii-cutover] READY for plaintext-drop planning");
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

main().catch((e) => {
  console.error("[pii-cutover] failed", e);
  process.exit(1);
});
