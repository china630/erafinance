/**
 * Azerbaijan VÖEN (10-digit TIN) validation.
 * Check digit and legal-status digit follow python-stdnum `stdnum.az.voen`
 * (weights on the first 8 digits, mod 11; 10th digit 1 = legal entity, 2 = natural person).
 */

const CHECK_WEIGHTS = [4, 1, 8, 6, 2, 7, 5, 3] as const;

/** Strip separators; pad legacy 9-digit input with a leading zero (stdnum.compact). */
export function compactVoen(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.replace(/\s+/g, "").trim();
  if (s === "") return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length === 9) return `0${digits}`;
  if (digits.length === 10) return digits;
  return null;
}

function calcCheckDigit(firstEight: string): string {
  let sum = 0;
  for (let i = 0; i < CHECK_WEIGHTS.length; i++) {
    sum += CHECK_WEIGHTS[i]! * Number(firstEight[i]!);
  }
  return String(sum % 11);
}

/** True if `compact` is a non-null string of exactly 10 digits (no checksum yet). */
export function isTenDigits(compact: string | null | undefined): boolean {
  return compact != null && /^\d{10}$/.test(compact);
}

/**
 * Validates compacted 10-digit VÖEN: checksum (9th digit) and legal/natural marker (10th: 1 or 2).
 */
export function isValidVoenChecksum(compactTen: string): boolean {
  if (!isTenDigits(compactTen)) return false;
  const ninth = calcCheckDigit(compactTen.slice(0, 8));
  if (compactTen.slice(8, 9) !== ninth) return false;
  const last = compactTen[9];
  return last === "1" || last === "2";
}

/** Namespace export for imports `VoenValidator.*` (see TZ / PRD). */
export const VoenValidator = {
  compactVoen,
  isTenDigits,
  isValidVoenChecksum,
  validateVoen,
} as const;

/** Normalize input and validate format + AZ check digit rules. */
export function validateVoen(raw: string | null | undefined): {
  ok: boolean;
  compact: string | null;
} {
  const compact = compactVoen(raw);
  if (!compact || !isTenDigits(compact)) {
    return { ok: false, compact };
  }
  return { ok: isValidVoenChecksum(compact), compact };
}
