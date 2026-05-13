/**
 * Parse normalized AZ customs act markdown (4-column pipe tables) into JSON for import.
 * Skips: strikethrough (~~) rows, XİF MN header rows, rows without a numeric HS in col0.
 * Usage: node parse-az-customs-act-md.mjs [--input path] [--output path]
 * Defaults: --input docs/tmp/az-customs-act.md (from monorepo root) --output packages/database/prisma/catalog/trade/customs-tariff-rates.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

function argValue(name, def) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

const inputPath = resolve(repoRoot, argValue("--input", "docs/tmp/az-customs-act.md"));
const outputPath = resolve(repoRoot, argValue("--output", "packages/database/prisma/catalog/trade/customs-tariff-rates.json"));

function splitPipeRow(line) {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  const parts = t.split("|");
  if (parts.length < 2) return null;
  const cells = parts
    .slice(1, -1)
    .map((c) => c.trim());
  return cells;
}

function extractHsDigits(cell) {
  if (!cell) return "";
  const head = cell
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\*+/g, "")
    .replace(/~~/g, "")
    .split(/[\[\(]/)[0]
    .trim();
  return head.replace(/\D/g, "");
}

function isHeaderRow(cells) {
  const c0 = (cells[0] || "").toLowerCase();
  if (c0.includes("x̧f mn") || c0.includes("xif mn") || c0.includes("xİf mn")) return true;
  if (c0.includes("kod") && c0.includes("**") && c0.includes("mal")) return true;
  return false;
}

function extractDutyPercent(raw) {
  if (!raw) return { duty: 0, hadPercent: false };
  const t = raw.replace(/\[[^\]]*\]\([^)]*\)/g, " ").replace(/\*+/g, "");
  if (/ABŞ\s*dollar|ABŞ dollar|USD|1\s*ABŞ/i.test(t) && !/^\s*\d+\s*%/.test(t)) {
    return { duty: 0, hadPercent: false };
  }
  const pct = t.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) {
    const n = Math.min(100, parseFloat(pct[1].replace(",", ".")));
    if (!Number.isNaN(n)) return { duty: n, hadPercent: true };
  }
  const lead = t.match(/\b(\d{1,3}(?:[.,]\d+)?)\b/);
  if (lead) {
    const n = Math.min(100, parseFloat(lead[1].replace(",", ".")));
    if (!Number.isNaN(n) && n <= 100) return { duty: n, hadPercent: false };
  }
  return { duty: 0, hadPercent: false };
}

const raw = readFileSync(inputPath, "utf8");
const lines = raw.split(/\r?\n/);
const out = [];
let skippedStrike = 0;
let skippedHeader = 0;
let skippedNoHs = 0;
let skippedBadColCount = 0;

for (const line of lines) {
  if (line.includes("~~")) {
    skippedStrike++;
    continue;
  }
  const cells = splitPipeRow(line);
  if (!cells) continue;
  if (cells.length !== 4) {
    if (cells.length > 0) skippedBadColCount++;
    continue;
  }
  if (isHeaderRow(cells)) {
    skippedHeader++;
    continue;
  }
  const hsDigits = extractHsDigits(cells[0] || "");
  if (hsDigits.length < 2 || hsDigits.length > 13) {
    skippedNoHs++;
    continue;
  }
  const description = (cells[1] || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  const lawUom = (cells[2] || "").trim().slice(0, 120);
  const rawTariff = (cells[3] || "").trim();
  const { duty } = extractDutyPercent(rawTariff);
  const notesParts = [`tariff_raw=${rawTariff.slice(0, 500)}`];
  if (lawUom) notesParts.push(`law_uom=${lawUom.slice(0, 120)}`);

  out.push({
    hsCode: hsDigits,
    description: description || null,
    dutyRatePercent: duty,
    vatRatePercent: 18,
    excisePercent: 0,
    notes: notesParts.join("; ").slice(0, 4000),
  });
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8");

console.log(`Parsed ${out.length} tariff rows from markdown`);
console.log(`Skipped ~~ rows: ${skippedStrike}, headers: ${skippedHeader}, no HS: ${skippedNoHs}, col≠4: ${skippedBadColCount}`);
console.log(`Wrote ${outputPath}`);
