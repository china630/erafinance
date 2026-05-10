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
    const report = {
      employeesFinCodeRiskPlain: await scalarCount(
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM employees WHERE fin_code IS NOT NULL AND LEFT(fin_code, 12) <> '__enc__fin__'`,
      ),
      employeesFirstNameRiskPlain: await scalarCount(
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM employees WHERE first_name IS NOT NULL AND LEFT(first_name, 11) <> '__enc__fn__'`,
      ),
      employeesLastNameRiskPlain: await scalarCount(
        prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM employees WHERE last_name IS NOT NULL AND LEFT(last_name, 11) <> '__enc__ln__'`,
      ),
    };

    const totalRisk = Object.values(report).reduce((sum, v) => sum + v, 0);
    console.info("[pii-guard] risk-plaintext counters:");
    for (const [k, v] of Object.entries(report)) {
      console.info(`[pii-guard]   ${k}=${v}`);
    }
    if (totalRisk > 0) {
      console.error(`[pii-guard] FAILED: totalRisk=${totalRisk}`);
      process.exit(1);
    }
    console.info("[pii-guard] OK: risk-plaintext is zero");
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

main().catch((e) => {
  console.error("[pii-guard] failed", e);
  process.exit(1);
});
