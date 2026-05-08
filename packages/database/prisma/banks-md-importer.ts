import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { BANK_GLOSSARY_SEED } from "./bank-glossary-seed";
import {
  parseBanksMd,
  type BanksMdHead,
  type BanksMdParseResult,
} from "./banks-md-parser";

export interface BanksMdImportOptions {
  /** When true, no DB writes happen — only the report is built. */
  dryRun: boolean;
  /** When set, only banks whose VÖEN is in this list are touched. */
  voenFilter?: string[] | null;
}

export interface BanksMdImportReport {
  parse: BanksMdParseResult;
  matched: ReadonlyArray<{
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
 * Read `docs/banks.md` and upsert (or, when `dryRun=true`, simulate the
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
