/**
 * Reads `prisma/catalog/bank/banks-table.md` and writes
 * `prisma/catalog/bank/bank-branches.generated.ts`.
 *
 * Run from `packages/database`:
 *   npm run db:gen:banks-branches-seed
 *
 * Commit the generated file. Runtime `db:seed` only imports the generated module.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BANK_GLOSSARY_SEED } from "../lib/bank/bank-glossary-seed";
import { parseBanksMd } from "../lib/bank/banks-md-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MD_PATH = resolve(__dirname, "../catalog/bank/banks-table.md");
const OUT_PATH = resolve(__dirname, "../catalog/bank/bank-branches.generated.ts");

const HEAD_NAME = "Baş ofis";

function escStr(s: string): string {
  return JSON.stringify(s);
}

function main(): void {
  const md = readFileSync(MD_PATH, "utf8");
  const { banks, warnings } = parseBanksMd(md);
  if (warnings.length) {
    console.warn(`[gen-banks-branches] parser warnings: ${warnings.length}`);
  }

  const allow = new Set(BANK_GLOSSARY_SEED.map((r) => r.voen));
  const lines: string[] = [];
  lines.push("/**");
  lines.push(" * AUTO-GENERATED — do not edit by hand.");
  lines.push(
    " * Regenerate: `npm run db:gen:banks-branches-seed` in @erafinance/database.",
  );
  lines.push(" */");
  lines.push("");
  lines.push(
    'import type { BankBranchSeedRow } from "../../lib/bank/banks-md-importer";',
  );
  lines.push("");
  lines.push("export const BANK_BRANCH_SEED_ROWS: readonly BankBranchSeedRow[] = [");

  for (const head of banks) {
    if (!allow.has(head.voen)) continue;

    lines.push(
      `  { voen: ${escStr(head.voen)}, branchCode: ${escStr(head.branchCode)}, name: ${escStr(HEAD_NAME)}, swift: ${head.swift == null ? "null" : escStr(head.swift)}, phones: ${JSON.stringify(head.phones)} as const, address: ${head.address == null ? "null" : escStr(head.address)}, isHeadOffice: true },`,
    );

    for (const br of head.branches) {
      const swift = br.swift ?? head.swift;
      lines.push(
        `  { voen: ${escStr(head.voen)}, branchCode: ${escStr(br.branchCode)}, name: ${escStr(br.nameAz)}, swift: ${swift == null ? "null" : escStr(swift)}, phones: ${JSON.stringify(br.phones)} as const, address: ${br.address == null ? "null" : escStr(br.address)}, isHeadOffice: false },`,
      );
    }
  }

  lines.push("];");
  lines.push("");

  writeFileSync(OUT_PATH, lines.join("\n") + "\n", "utf8");
  const rowCount = lines.filter((l) => l.trim().startsWith("{ voen:")).length;
  console.info(`[gen-banks-branches] wrote ${OUT_PATH} (${rowCount} rows)`);
}

main();
