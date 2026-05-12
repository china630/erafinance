/**
 * One-off / CI helper: writes prisma/catalog/national/chart-of-accounts-{commercial|budget|ngo}.json
 * from ERA commercial TS source + parsed docs/NAS-GOV.md and docs/NAS-NGO.md.
 *
 * Run from repo root: npx tsx packages/database/prisma/scripts/build-nas-catalog-jsons.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AccountType } from "@prisma/client";
import { normalizeChartAccountSeedRow } from "../lib/chart/chart-seed";

/** Run from `packages/database`: `npx tsx prisma/scripts/build-nas-catalog-jsons.ts` */
const catalogDir = join(process.cwd(), "prisma", "catalog", "national");
const docsDir = join(process.cwd(), "..", "..", "docs");

type Seed = {
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  type: AccountType;
  parentCode: string | null;
};

function ruSameAsAz(az: string): string {
  // Placeholder: product requirement was AZ+RU in JSON; RU translations for budget/NGO
  // are filled with Russian glosses where obvious; else mirror AZ for manual follow-up.
  return az;
}

/** Minimal CSV line split respecting quoted fields with commas. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function inferGovType(sectionCode: string): AccountType {
  const n = parseInt(sectionCode, 10);
  if (n <= 2) return AccountType.ASSET;
  if (n === 3) return AccountType.LIABILITY;
  if (n === 4) return AccountType.LIABILITY;
  if (n === 5) return AccountType.EQUITY;
  if (n === 6) return AccountType.REVENUE;
  if (n === 7) return AccountType.EXPENSE;
  if (n === 8) return AccountType.EQUITY;
  if (n === 9) return AccountType.EXPENSE;
  return AccountType.ASSET;
}

function parseNasGov(): Seed[] {
  const raw = readFileSync(join(docsDir, "NAS-GOV.md"), "utf-8");
  const lines = raw.split(/\r?\n/).slice(1); // skip header
  const accounts: Seed[] = [];
  let sectionMain: string | null = null; // "1".."9" top chapter when present
  let currentType = AccountType.ASSET;
  /** One synthetic root per NAS-GOV chapter digit (children use parentCode = section digit). */
  const sectionRoots = new Set<string>();

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const c0 = (cells[0] ?? "").replace(/^"|"$/g, "").trim();
    const c1 = (cells[1] ?? "").replace(/^"|"$/g, "").trim();
    const c2 = (cells[2] ?? "").replace(/^"|"$/g, "").trim();
    const c3 = (cells[3] ?? "").replace(/^"|"$/g, "").trim();

    // Chapter row: "Uzunmüddətli aktivlər","2",,
    if (c1 && /^\d$/.test(c1) && !c2 && !c3) {
      sectionMain = c1;
      currentType = inferGovType(sectionMain);
      if (!sectionRoots.has(sectionMain)) {
        sectionRoots.add(sectionMain);
        const title = c0 || `Section ${sectionMain}`;
        accounts.push({
          code: sectionMain,
          nameAz: title,
          nameRu: ruSameAsAz(title),
          nameEn: title,
          type: currentType,
          parentCode: null,
        });
      }
      continue;
    }

    // Group row: name + two-digit group "10"
    if (c0 && c1 && /^\d{2}$/.test(c1) && !c2 && !c3) {
      const code = c1;
      accounts.push({
        code,
        nameAz: c0,
        nameRu: ruSameAsAz(c0),
        nameEn: c0,
        type: currentType,
        parentCode: /^\d$/.test(sectionMain ?? "") ? sectionMain : null,
      });
      continue;
    }

    // Account 101 or subaccount in c2
    const accCode = c1 || c2;
    const name = c3 || c0;
    if (!accCode || !name) continue;
    if (!/^[\d]+(-[\d]+)?$/.test(accCode)) continue;

    let parentCode: string | null = null;
    if (accCode.includes("-")) {
      parentCode = accCode.split("-")[0] ?? null;
    } else if (/^\d{3}$/.test(accCode)) {
      parentCode = accCode.slice(0, 2);
    } else if (/^\d{2}$/.test(accCode)) {
      parentCode = /^\d$/.test(sectionMain ?? "") ? sectionMain : null;
    }

    accounts.push({
      code: accCode,
      nameAz: name,
      nameRu: ruSameAsAz(name),
      nameEn: name,
      type: currentType,
      parentCode,
    });
  }

  return ensureNasGovParentClosure(accounts);
}

function inferNgoType(sectionNum: number): AccountType {
  if (sectionNum <= 2) return AccountType.ASSET;
  if (sectionNum === 3) return AccountType.EQUITY;
  if (sectionNum === 4 || sectionNum === 5) return AccountType.LIABILITY;
  if (sectionNum === 6) return AccountType.REVENUE;
  if (sectionNum === 7) return AccountType.EXPENSE;
  if (sectionNum === 8) return AccountType.EQUITY;
  if (sectionNum === 9) return AccountType.EXPENSE;
  return AccountType.ASSET;
}

function parseNasNgo(): Seed[] {
  const raw = readFileSync(join(docsDir, "NAS-NGO.md"), "utf-8");
  const lines = raw.split(/\r?\n/).slice(1);
  const accounts: Seed[] = [];
  let sectionNum = 1;
  let currentType = inferNgoType(sectionNum);
  let lastGroupCode: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const a0 = (cells[0] ?? "").replace(/^"|"$/g, "").trim();
    const a1 = (cells[1] ?? "").replace(/^"|"$/g, "").trim();
    const a2 = (cells[2] ?? "").replace(/^"|"$/g, "").trim();

    const mSec = a0.match(/^(\d+)\.\s/);
    if (mSec && !a1) {
      sectionNum = parseInt(mSec[1]!, 10);
      currentType = inferNgoType(sectionNum);
      const code = String(sectionNum);
      accounts.push({
        code,
        nameAz: a0,
        nameRu: ruSameAsAz(a0),
        nameEn: a0,
        type: currentType,
        parentCode: null,
      });
      lastGroupCode = null;
      continue;
    }

    // Group header: quoted name only in col0, optional code+name in col1/2
    if (a0 && !a1 && !a2) {
      const synthetic = `G-${sectionNum}-${accounts.length}`;
      accounts.push({
        code: synthetic,
        nameAz: a0,
        nameRu: ruSameAsAz(a0),
        nameEn: a0,
        type: currentType,
        parentCode: String(sectionNum),
      });
      lastGroupCode = synthetic;
      continue;
    }

    // "Name",111,Name continuation possibly with commas — handled by parseCsvLine
    // "GroupName",111,Name — group header with 3-digit code in col1
    if (a0 && /^\d{3}$/.test(a1) && a2) {
      lastGroupCode = a1;
      accounts.push({
        code: a1,
        nameAz: a2,
        nameRu: ruSameAsAz(a2),
        nameEn: a2,
        type: currentType,
        parentCode: String(sectionNum),
      });
      continue;
    }

    // ,102,Name — leaf under last group or section
    if (!a0 && /^\d{3}$/.test(a1) && a2) {
      accounts.push({
        code: a1,
        nameAz: a2,
        nameRu: ruSameAsAz(a2),
        nameEn: a2,
        type: currentType,
        parentCode: lastGroupCode ?? String(sectionNum),
      });
    }
  }

  return dedupeByCode(accounts);
}

function dedupeByCode(rows: Seed[]): Seed[] {
  const seen = new Set<string>();
  const out: Seed[] = [];
  for (const r of rows) {
    if (seen.has(r.code)) continue;
    seen.add(r.code);
    out.push(r);
  }
  return out;
}

/** NAS-GOV CSV sometimes lists 3-digit accounts without an explicit 2-digit group row — synthesize missing parents. */
function ensureNasGovParentClosure(rows: Seed[]): Seed[] {
  let cur = dedupeByCode(rows);
  for (let guard = 0; guard < 30; guard++) {
    const by = new Map(cur.map((r) => [r.code, r]));
    const missing = new Set<string>();
    for (const r of cur) {
      if (r.parentCode && !by.has(r.parentCode)) {
        missing.add(r.parentCode);
      }
    }
    if (missing.size === 0) return cur;
    const extra: Seed[] = [];
    for (const pc of missing) {
      if (/^\d{2}$/.test(pc)) {
        const section = pc[0]!;
        if (!/^\d$/.test(section) || !by.has(section)) continue;
        const sample = cur.find((x) => x.parentCode === pc);
        const type = sample?.type ?? inferGovType(section);
        const nameAz = `[NAS-GOV group ${pc}]`;
        extra.push({
          code: pc,
          nameAz,
          nameRu: ruSameAsAz(nameAz),
          nameEn: nameAz,
          type,
          parentCode: section,
        });
      }
    }
    if (extra.length === 0) return cur;
    cur = dedupeByCode([...extra, ...cur]);
  }
  return cur;
}

function writeJson(name: string, kind: string, accounts: Seed[]) {
  const payload = {
    meta: { kind, source: "docs", locale: "az+ru" },
    accounts,
  };
  writeFileSync(join(catalogDir, name), `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

/** Round-trip / refresh: commercial JSON is the canonical source in repo; budget/ngo parsed from docs. */
function loadCommercialSeedsFromJson(): Seed[] {
  const path = join(catalogDir, "chart-of-accounts-commercial.json");
  if (!existsSync(path)) {
    throw new Error(
      `[build-nas-catalog-jsons] Missing ${path}. Restore from git or create initial commercial JSON before running this script.`,
    );
  }
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as { accounts: Record<string, unknown>[] };
  if (!parsed.accounts?.length) {
    throw new Error(`[build-nas-catalog-jsons] Empty accounts in ${path}`);
  }
  return parsed.accounts.map((row) => {
    const n = normalizeChartAccountSeedRow(row);
    return {
      code: n.code,
      nameAz: n.nameAz,
      nameRu: n.nameRu,
      nameEn: n.nameEn,
      type: n.type as AccountType,
      parentCode: n.parentCode?.trim() || null,
    };
  });
}

const commercial = loadCommercialSeedsFromJson();
writeJson("chart-of-accounts-commercial.json", "COMMERCIAL", commercial);
writeJson("chart-of-accounts-budget.json", "BUDGET", parseNasGov());
writeJson("chart-of-accounts-ngo.json", "NGO", parseNasNgo());

console.info(
  `[build-nas-catalog-jsons] wrote commercial (${commercial.length}), budget, ngo → ${catalogDir}`,
);
