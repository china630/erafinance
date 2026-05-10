/** Canonical codes in `units_of_measure` (Phase 10). */
const CANON = new Set([
  "pcs",
  "kg",
  "m",
  "m2",
  "pack",
  "litre",
  "hour",
]);

/** Map common free-text / locale aliases to catalog `code`. Keys are lowercased ASCII-ish. */
const ALIASES: Record<string, string> = {
  штук: "pcs",
  шт: "pcs",
  piece: "pcs",
  pieces: "pcs",
  ədəd: "pcs",
  кг: "kg",
  kq: "kg",
  kilogram: "kg",
  kilograms: "kg",
  метр: "m",
  metr: "m",
  "кв.м": "m2",
  квм: "m2",
  л: "litre",
  литр: "litre",
  litr: "litre",
  paçka: "pack",
  pack: "pack",
  час: "hour",
  чac: "hour",
  saat: "hour",
};

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/²/g, "2")
    .replace(/м²/g, "m2");
}

/**
 * Maps portal / legacy unit strings to `units_of_measure.code`, or null if unknown (DB stores NULL).
 */
export function normalizeUnitInputToCatalogCode(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const raw = input.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (CANON.has(lower)) return lower;
  const key = normalizeKey(raw);
  if (CANON.has(key)) return key;
  const mapped = ALIASES[key] ?? ALIASES[lower];
  if (mapped) return mapped;
  return null;
}
