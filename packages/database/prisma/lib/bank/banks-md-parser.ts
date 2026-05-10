/**
 * Pure-function parser for Azerbaijan bank/branch markdown tables (CBA-style).
 *
 * The MD file is the result of an OCR/PDF dump and has predictable but messy
 * layout. Each non-empty markdown table row is one of:
 *   - HEAD bank: `| <int> | <name> | <iban> | <branchCode> | <voen> | <swift> | <phones?> | <address?> |`
 *   - BRANCH:   `| <int>.<int> | ... (same columns) ... |`
 *
 * The parser is intentionally tolerant: it drops malformed rows but always
 * records a `warning` so the importer can surface them to the operator.
 */

export interface BanksMdHead {
  /** Position in MD (`9`, `10`, `11`, ...). NOT our platform `code`. */
  rowIndex: number;
  /** Original raw name (un-normalized). */
  rawName: string;
  /** Normalized display name (azerbaijani). */
  nameAz: string;
  /** Correspondent IBAN of the bank in CBA (same on every branch row). */
  correspondentIban: string;
  /** 6-digit MFO code of the head office. */
  branchCode: string;
  /** 10-digit VÖEN of the bank legal entity. */
  voen: string;
  /** SWIFT/BIC code of the bank. */
  swift: string | null;
  /** Phone numbers of the head office (already split & normalized). */
  phones: string[];
  /** Free-text head office address. */
  address: string | null;
  branches: BanksMdBranch[];
}

export interface BanksMdBranch {
  /** Position in MD (`9.12`). */
  subIndex: number;
  rawName: string;
  nameAz: string;
  /** 6-digit MFO of this branch (UNIQUE within bank). */
  branchCode: string;
  swift: string | null;
  phones: string[];
  address: string | null;
}

export interface BanksMdParseResult {
  banks: BanksMdHead[];
  warnings: string[];
}

const VOEN_RE = /^\d{10}$/;
const IBAN_RE = /^AZ\d{2}[A-Z]{4}\d{20}$/;
const BRANCH_CODE_RE = /^\d{4,7}$/;
const PHONE_RE = /^(?:\+\d{6,14}|\d{2,4})$/;
const ROW_ID_RE = /^(\d+)(?:\.(\d+))?$/;
const SWIFT_RE = /^[A-Z]{6}[A-Z0-9]{2,5}$/;

/**
 * Heuristic re-spacing for OCR-merged azerbaijani bank names.
 *
 * We only insert spaces in conservative spots: before known business-form
 * suffixes (ASC/QSC), before `Bankı`, between camelCase boundaries, and
 * between azerbaijani lowercase ↔ uppercase pairs.
 */
export function normalizeBankName(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/\u200b|\u00a0/g, " ").trim();
  s = s.replace(/\s+/g, " ");

  s = s.replace(/(\S)(ASC|QSC|MMC|OJSC|CJSC|LLC|JSC)\b/g, "$1 $2");
  s = s.replace(/([A-Za-zəıöğüşçĞÜŞİÖÇƏ])(Bankı|BANK|Bank)\b/g, "$1 $2");
  s = s.replace(
    /([a-zəıöğüşç])([A-ZƏIİÖĞÜŞÇ])/g,
    (_, a: string, b: string) => `${a} ${b}`,
  );
  s = s.replace(/(\S)(filialı|şöbəsi|şöbə)\b/gi, "$1 $2");

  return s.replace(/\s+/g, " ").trim();
}

export function normalizePhones(raw: string | null | undefined): {
  phones: string[];
  invalid: string[];
} {
  if (!raw) return { phones: [], invalid: [] };
  const tokens = raw
    .replace(/\u200b|\u00a0/g, " ")
    .split(/[;,]/)
    .map((p) => p.replace(/[\s()-]/g, "").trim())
    .filter(Boolean);
  const phones: string[] = [];
  const invalid: string[] = [];
  for (const t of tokens) {
    if (PHONE_RE.test(t)) phones.push(t);
    else invalid.push(t);
  }
  return { phones: Array.from(new Set(phones)), invalid };
}

export function normalizeAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const collapsed = raw
    .replace(/\u200b|\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed || null;
}

export function normalizeIban(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  return IBAN_RE.test(cleaned) ? cleaned : null;
}

export function normalizeVoen(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return VOEN_RE.test(digits) ? digits : null;
}

export function normalizeBranchCode(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return BRANCH_CODE_RE.test(digits) ? digits : null;
}

export function normalizeSwift(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  return SWIFT_RE.test(cleaned) ? cleaned : null;
}

/** Split a markdown table row into trimmed cells, dropping outer pipes. */
function splitMdRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

/**
 * Parse a markdown bank table into a tree of head banks → branches.
 *
 * The function is *pure* (no IO, no Prisma); the caller passes the raw
 * markdown content as a string.
 */
export function parseBanksMd(content: string): BanksMdParseResult {
  const warnings: string[] = [];
  const headByRow = new Map<number, BanksMdHead>();

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const cells = splitMdRow(line);
    if (!cells || cells.length < 6) continue;
    if (/^[-: ]+$/.test(cells[0]?.replace(/\|/g, "") ?? "")) continue;

    const idMatch = ROW_ID_RE.exec(cells[0] ?? "");
    if (!idMatch) continue;

    const rowIndex = Number.parseInt(idMatch[1] ?? "", 10);
    const subRaw = idMatch[2];
    const isHead = subRaw === undefined;

    const rawName = cells[1] ?? "";
    const ibanCell = cells[2] ?? "";
    const branchCodeCell = cells[3] ?? "";
    const voenCell = cells[4] ?? "";
    const swiftCell = cells[5] ?? "";
    const phonesCell = cells[6] ?? "";
    const addressCell = cells[7] ?? "";

    const branchCode = normalizeBranchCode(branchCodeCell);
    const voen = normalizeVoen(voenCell);
    const swift = normalizeSwift(swiftCell);
    const { phones, invalid } = normalizePhones(phonesCell);
    const address = normalizeAddress(addressCell);
    const nameAz = normalizeBankName(rawName);

    if (invalid.length > 0) {
      warnings.push(
        `row ${cells[0]}: ${invalid.length} invalid phone(s) skipped: ${invalid.join(",")}`,
      );
    }

    if (isHead) {
      const correspondentIban = normalizeIban(ibanCell);
      if (!correspondentIban) {
        warnings.push(
          `row ${cells[0]}: head bank skipped (invalid IBAN: "${ibanCell}")`,
        );
        continue;
      }
      if (!voen) {
        warnings.push(
          `row ${cells[0]}: head bank skipped (invalid VÖEN: "${voenCell}")`,
        );
        continue;
      }
      if (!branchCode) {
        warnings.push(
          `row ${cells[0]}: head bank skipped (invalid head branch code: "${branchCodeCell}")`,
        );
        continue;
      }
      if (!nameAz) {
        warnings.push(
          `row ${cells[0]}: head bank skipped (empty name)`,
        );
        continue;
      }
      headByRow.set(rowIndex, {
        rowIndex,
        rawName,
        nameAz,
        correspondentIban,
        branchCode,
        voen,
        swift,
        phones,
        address,
        branches: [],
      });
      continue;
    }

    // Branch row: inherits name normalization, requires branchCode.
    const subIndex = Number.parseInt(subRaw ?? "", 10);
    if (!Number.isFinite(subIndex)) {
      warnings.push(`row ${cells[0]}: invalid sub-index, skipped`);
      continue;
    }
    const head = headByRow.get(rowIndex);
    if (!head) {
      warnings.push(
        `row ${cells[0]}: branch precedes its head bank (rowIndex=${rowIndex}); skipped`,
      );
      continue;
    }
    if (!branchCode) {
      warnings.push(
        `row ${cells[0]}: branch skipped (invalid branch code: "${branchCodeCell}")`,
      );
      continue;
    }
    const branchName = nameAz || `Filial ${rowIndex}.${subIndex}`;
    head.branches.push({
      subIndex,
      rawName,
      nameAz: branchName,
      branchCode,
      swift,
      phones,
      address,
    });
  }

  const banks = Array.from(headByRow.values()).sort(
    (a, b) => a.rowIndex - b.rowIndex,
  );
  return { banks, warnings };
}
