/**
 * CLI entry point: `tsx prisma/scripts/import-banks-md.ts [--dry-run] [--file=path]`
 *
 * Default `--file` path is `prisma/catalog/bank/banks-table.md` in this package.
 * prints a human-readable report to stdout and exits with code 0 on success
 * (even in dry-run with unmatched VÖENs — the report is the deliverable).
 *
 * Examples:
 *   npm run db:import-banks-md -- --dry-run
 *   npm run db:import-banks-md -- --file=prisma/catalog/bank/banks-table.md
 *   npm run db:import-banks-md -- --voen=9900003241,1301323981
 */
import { resolve } from "node:path";
import { closePrismaPool, createPrismaClient } from "../prisma-client";
import {
  formatBanksMdReport,
  importBanksMd,
  resolveDefaultBanksMdPath,
} from "../lib/bank/banks-md-importer";

interface ParsedArgs {
  dryRun: boolean;
  file: string;
  voenFilter: string[] | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  let dryRun = false;
  let file = resolveDefaultBanksMdPath();
  let voenFilter: string[] | null = null;
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run" || raw === "-n") {
      dryRun = true;
    } else if (raw.startsWith("--file=")) {
      file = resolve(raw.slice("--file=".length));
    } else if (raw.startsWith("--voen=")) {
      const value = raw.slice("--voen=".length).trim();
      voenFilter = value.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
    } else if (raw === "--help" || raw === "-h") {
      console.info(
        "Usage: tsx prisma/scripts/import-banks-md.ts [--dry-run] [--file=PATH] [--voen=A,B]",
      );
      process.exit(0);
    } else if (raw.startsWith("-")) {
      console.error(`[banks-md] unknown flag: ${raw}`);
      process.exit(2);
    }
  }
  return { dryRun, file, voenFilter };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const prisma = args.dryRun ? null : createPrismaClient();
  try {
    const report = await importBanksMd(prisma, args.file, {
      dryRun: args.dryRun,
      voenFilter: args.voenFilter,
    });
    console.info(
      `[banks-md] mode=${args.dryRun ? "dry-run" : "apply"} file=${args.file}`,
    );
    console.info(formatBanksMdReport(report));
  } finally {
    if (prisma) {
      await prisma.$disconnect();
      await closePrismaPool();
    }
  }
}

main().catch((err) => {
  console.error("[banks-md] FATAL", err);
  process.exit(1);
});
