import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { BANK_GLOSSARY_SEED } from "./bank-glossary-seed";
import {
  parseBanksMd,
  type BanksMdHead,
  type BanksMdParseResult,
} from "./banks-md-parser";

/** Default bank/branch markdown inside this package (`prisma/catalog/bank/banks-table.md`). */
export function resolveDefaultBanksMdPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "catalog", "bank", "banks-table.md");
}

export interface BanksMdImportOptions {
  /** When true, no DB writes happen — only the report is built. */
  dryRun: boolean;
  /** When set, only banks whose VÖEN is in this list are touched. */
  voenFilter?: string[] | null;
}

export interface BanksMdImportReport {
  parse: BanksMdParseResult;
  matched: Array<{
    voen: string;
    /** Platform `BankGlossary.code` (e.g. "14"). */
    code: string;
    headRowIndex: number;
    branchCount: number;
  }>;
  unmatchedHeadVoens: string[];
  bankGlossaryUpserts: number;
  bankBranchUpserts: number;
}

const HEAD_OFFICE_DEFAULT_NAME = "Baş ofis";

/**
 * Read a bank markdown table (default: `prisma/catalog/bank/banks-table.md`) and upsert (or, when `dryRun=true`, simulate the
 * upsert of) `BankGlossary` and `BankBranch` rows.
 *
 * Mapping rule: each parsed head bank from MD is matched to an existing
 * `BankGlossary` row **by VÖEN** (the platform-fixed `code` 01..22 is NOT
 * inferred from the MD position). Head banks whose VÖEN is unknown to the
 * platform are listed in `unmatchedHeadVoens` and skipped.
 *
 * The function MUST be idempotent — calling it twice produces the same
 * resulting state and the same upsert counts (each call still re-applies
 * the markdown content, but no rows are duplicated).
 */
export async function importBanksMd(
  prisma: PrismaClient | null,
  filePath: string,
  options: BanksMdImportOptions,
): Promise<BanksMdImportReport> {
  if (!options.dryRun && !prisma) {
    throw new Error("importBanksMd: prisma client required when dryRun=false");
  }
  const absolutePath = resolve(filePath);
  const content = await readFile(absolutePath, "utf8");
  const parse = parseBanksMd(content);

  const seedByVoen = new Map(BANK_GLOSSARY_SEED.map((s) => [s.voen, s]));
  const filter =
    options.voenFilter && options.voenFilter.length
      ? new Set(options.voenFilter)
      : null;

  const matched: BanksMdImportReport["matched"] = [];
  const unmatchedHeadVoens: string[] = [];
  let bankGlossaryUpserts = 0;
  let bankBranchUpserts = 0;

  for (const head of parse.banks) {
    if (filter && !filter.has(head.voen)) continue;
    const seed = seedByVoen.get(head.voen);
    if (!seed) {
      unmatchedHeadVoens.push(head.voen);
      continue;
    }

    if (!options.dryRun) {
      await prisma!.$transaction(async (tx) => {
        const glossary = await tx.bankGlossary.upsert({
          where: { code: seed.code },
          update: {
            nameAz: head.nameAz,
            voen: head.voen,
            correspondentIban: head.correspondentIban,
            swift: head.swift,
            headPhones: head.phones,
            headAddress: head.address,
            isActive: true,
          },
          create: {
            code: seed.code,
            nameAz: head.nameAz,
            voen: head.voen,
            correspondentIban: head.correspondentIban,
            swift: head.swift,
            headPhones: head.phones,
            headAddress: head.address,
            isActive: true,
          },
        });
        bankGlossaryUpserts += 1;

        await upsertBranchRow(tx, glossary.id, {
          branchCode: head.branchCode,
          name: HEAD_OFFICE_DEFAULT_NAME,
          swift: head.swift,
          address: head.address,
          phones: head.phones,
          isHeadOffice: true,
        });
        bankBranchUpserts += 1;

        for (const branch of head.branches) {
          await upsertBranchRow(tx, glossary.id, {
            branchCode: branch.branchCode,
            name: branch.nameAz,
            swift: branch.swift ?? head.swift,
            address: branch.address,
            phones: branch.phones,
            isHeadOffice: false,
          });
          bankBranchUpserts += 1;
        }
      });
    } else {
      bankGlossaryUpserts += 1;
      bankBranchUpserts += 1 + head.branches.length;
    }

    matched.push({
      voen: head.voen,
      code: seed.code,
      headRowIndex: head.rowIndex,
      branchCount: head.branches.length,
    });
  }

  return {
    parse,
    matched,
    unmatchedHeadVoens,
    bankGlossaryUpserts,
    bankBranchUpserts,
  };
}

interface BranchUpsertInput {
  branchCode: string;
  name: string;
  swift: string | null;
  address: string | null;
  phones: string[];
  isHeadOffice: boolean;
}

async function upsertBranchRow(
  tx: Pick<PrismaClient, "bankBranch">,
  bankId: string,
  input: BranchUpsertInput,
): Promise<void> {
  await tx.bankBranch.upsert({
    where: {
      bankId_branchCode: { bankId, branchCode: input.branchCode },
    },
    update: {
      name: input.name,
      swift: input.swift,
      address: input.address,
      phones: input.phones,
      isHeadOffice: input.isHeadOffice,
      isActive: true,
    },
    create: {
      bankId,
      branchCode: input.branchCode,
      name: input.name,
      swift: input.swift,
      address: input.address,
      phones: input.phones,
      isHeadOffice: input.isHeadOffice,
      isActive: true,
    },
  });
}

/** Serialized branch row (from `catalog/bank/banks-table.md` via codegen). */
export interface BankBranchSeedRow {
  voen: string;
  branchCode: string;
  name: string;
  swift: string | null;
  phones: readonly string[];
  address: string | null;
  isHeadOffice: boolean;
}

/**
 * Upserts `BankBranch` rows from a static seed (see `catalog/bank/bank-branches.generated.ts`).
 * Match banks by VÖEN to `BANK_GLOSSARY_SEED.code`. Run after `seedBankGlossary`.
 */
export async function seedBankBranchRows(
  prisma: PrismaClient,
  rows: readonly BankBranchSeedRow[],
): Promise<{ branchUpserts: number }> {
  const seedByVoen = new Map(BANK_GLOSSARY_SEED.map((s) => [s.voen, s]));
  const byVoen = new Map<string, BankBranchSeedRow[]>();
  for (const row of rows) {
    const list = byVoen.get(row.voen) ?? [];
    list.push(row);
    byVoen.set(row.voen, list);
  }

  let branchUpserts = 0;
  await prisma.$transaction(async (tx) => {
    for (const [voen, list] of byVoen) {
      const seed = seedByVoen.get(voen);
      if (!seed) continue;
      const glossary = await tx.bankGlossary.findUnique({
        where: { code: seed.code },
        select: { id: true },
      });
      if (!glossary) continue;

      for (const row of list) {
        await upsertBranchRow(tx, glossary.id, {
          branchCode: row.branchCode,
          name: row.name,
          swift: row.swift,
          address: row.address,
          phones: [...row.phones],
          isHeadOffice: row.isHeadOffice,
        });
        branchUpserts += 1;
      }
    }
  });

  return { branchUpserts };
}

/** Pretty-print the report for CLI consumers. */
export function formatBanksMdReport(report: BanksMdImportReport): string {
  const { parse, matched, unmatchedHeadVoens } = report;
  const lines: string[] = [];
  lines.push(
    `[banks-md] parsed ${parse.banks.length} head bank(s), ` +
      `${parse.banks.reduce((s, h) => s + h.branches.length, 0)} branch(es)`,
  );
  lines.push(
    `[banks-md] matched ${matched.length} bank(s) by VÖEN; ` +
      `unmatched: ${unmatchedHeadVoens.length}`,
  );
  if (unmatchedHeadVoens.length) {
    lines.push(
      `[banks-md] unmatched VÖEN list: ${unmatchedHeadVoens.join(", ")}`,
    );
  }
  if (matched.length) {
    lines.push("[banks-md] matched bank breakdown:");
    for (const m of matched) {
      lines.push(
        `[banks-md]   - code=${m.code} voen=${m.voen} mdRow=${m.headRowIndex} branches=${m.branchCount}`,
      );
    }
  }
  if (parse.warnings.length) {
    lines.push(`[banks-md] parser warnings (${parse.warnings.length}):`);
    for (const w of parse.warnings.slice(0, 30)) {
      lines.push(`[banks-md]   * ${w}`);
    }
    if (parse.warnings.length > 30) {
      lines.push(
        `[banks-md]   ... and ${parse.warnings.length - 30} more (truncated)`,
      );
    }
  }
  lines.push(
    `[banks-md] upserts: bankGlossary=${report.bankGlossaryUpserts}, ` +
      `bankBranches=${report.bankBranchUpserts}`,
  );
  return lines.join("\n");
}
