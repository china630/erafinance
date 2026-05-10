/**
 * Batch upsert parsed customs tariff JSON into customs_tariff_rates.
 * Usage:
 *   npx tsx packages/database/scripts/import-customs-tariff-from-json.ts <path.json> [--effective-from=YYYY-MM-DD] [--notes-prefix=text] [--dry-run]
 * Loads `.env` from monorepo root (or cwd) so DATABASE_URL is set without extra tooling.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Prisma } from "@prisma/client";
import { closePrismaPool, createPrismaClient } from "../prisma/prisma-client";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRootEnv(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
    resolve(process.cwd(), "..", "..", ".env"),
    resolve(__dirname, "..", "..", "..", ".env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadDotenv({ path: p });
      return;
    }
  }
}

type Row = {
  hsCode: string;
  description?: string | null;
  dutyRatePercent: number;
  vatRatePercent: number;
  excisePercent: number;
  notes?: string | null;
};

function parseArgs(argv: string[]) {
  let file = "";
  let effectiveFrom = "2000-01-01";
  let notesPrefix = "";
  let dryRun = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--effective-from="))
      effectiveFrom = a.slice("--effective-from=".length).slice(0, 10);
    else if (a.startsWith("--notes-prefix=")) notesPrefix = a.slice("--notes-prefix=".length);
    else if (!a.startsWith("-") && !file) file = a;
  }
  return { file, effectiveFrom, notesPrefix, dryRun };
}

function validateHs(hs: string): string {
  const d = hs.replace(/\D/g, "").trim();
  if (d.length < 2 || d.length > 13) throw new Error(`Invalid hs_code length: ${hs}`);
  return d;
}

function validatePct(n: number, field: string) {
  if (typeof n !== "number" || Number.isNaN(n) || n < 0 || n > 100) {
    throw new Error(`Invalid ${field}: ${n}`);
  }
}

async function main() {
  loadRootEnv();
  const { file, effectiveFrom, notesPrefix, dryRun } = parseArgs(process.argv);
  if (!file) {
    console.error(
      "Usage: import-customs-tariff-from-json.ts <file.json> [--effective-from=YYYY-MM-DD] [--notes-prefix=] [--dry-run]",
    );
    process.exit(1);
  }
  const jsonPath = file.startsWith("/") || /^[A-Za-z]:/.test(file) ? file : join(process.cwd(), file);
  const rows = JSON.parse(readFileSync(jsonPath, "utf-8")) as Row[];
  if (!Array.isArray(rows)) throw new Error("JSON root must be an array");

  const effectiveFromDate = new Date(`${effectiveFrom}T00:00:00.000Z`);
  if (Number.isNaN(effectiveFromDate.getTime())) throw new Error("Invalid effective-from date");

  if (dryRun) {
    for (const r of rows) {
      validateHs(r.hsCode);
      validatePct(r.dutyRatePercent, "dutyRatePercent");
      validatePct(r.vatRatePercent, "vatRatePercent");
      validatePct(r.excisePercent, "excisePercent");
    }
    console.log(`[dry-run] validated ${rows.length} rows (effective_from=${effectiveFrom})`);
    return;
  }

  const prisma = createPrismaClient();
  let ok = 0;
  try {
    for (const r of rows) {
      const hs = validateHs(r.hsCode);
      validatePct(r.dutyRatePercent, "dutyRatePercent");
      validatePct(r.vatRatePercent, "vatRatePercent");
      validatePct(r.excisePercent, "excisePercent");
      const notes = [notesPrefix, r.notes].filter(Boolean).join(" | ").slice(0, 8000) || null;
      await prisma.customsTariffRate.upsert({
        where: {
          hsCode_effectiveFrom: { hsCode: hs, effectiveFrom: effectiveFromDate },
        },
        create: {
          hsCode: hs,
          description: r.description ?? null,
          dutyRatePercent: new Prisma.Decimal(r.dutyRatePercent),
          vatRatePercent: new Prisma.Decimal(r.vatRatePercent),
          excisePercent: new Prisma.Decimal(r.excisePercent),
          effectiveFrom: effectiveFromDate,
          notes,
        },
        update: {
          description: r.description ?? null,
          dutyRatePercent: new Prisma.Decimal(r.dutyRatePercent),
          vatRatePercent: new Prisma.Decimal(r.vatRatePercent),
          excisePercent: new Prisma.Decimal(r.excisePercent),
          notes,
          deletedAt: null,
        },
      });
      ok++;
    }
    console.log(`customs_tariff_rates upserted: ${ok} rows (effective_from=${effectiveFrom})`);
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
