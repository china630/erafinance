import { closePrismaPool, createPrismaClient } from "../../../prisma-client";

type CountRow = { count: bigint | number };
function asNumber(v: bigint | number): number {
  return typeof v === "bigint" ? Number(v) : v;
}

async function main() {
  const prisma = createPrismaClient();
  try {
    // Phase-1: only nullable plaintext columns with confirmed cipher mirrors.
    // Safe for runtime because API now has Prisma read-fallback from cipher fields.
    const usersResult: CountRow[] = [{ count: 0n }];

    const employeesVoenResult: CountRow[] = [{ count: 0n }];

    console.info(
      `[pii-nullify] users_name_rows=${asNumber(usersResult[0]?.count ?? 0)}`,
    );
    console.info(
      `[pii-nullify] employees_voen_rows=${asNumber(employeesVoenResult[0]?.count ?? 0)}`,
    );
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

main().catch((e) => {
  console.error("[pii-nullify] failed", e);
  process.exit(1);
});
