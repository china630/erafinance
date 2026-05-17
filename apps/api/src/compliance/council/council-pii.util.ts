import { MASKED, normalizeSensitiveKey } from "../../privacy/data-masking.service";

const COUNCIL_EXTRA_SENSITIVE = [
  "taxid",
  "tax_id",
  "voen",
  "fin",
  "email",
  "phone",
  "fullname",
  "full_name",
  "firstname",
  "lastname",
  "directorname",
  "director_name",
  "legaladdress",
  "legal_address",
  "name",
  "iban",
  "accountnumber",
] as const;

const councilSensitive = new Set(
  [...COUNCIL_EXTRA_SENSITIVE].map(normalizeSensitiveKey),
);

function isCouncilSensitiveKey(key: string): boolean {
  const n = normalizeSensitiveKey(key);
  if (councilSensitive.has(n)) return true;
  return n.includes("voen") || n.includes("taxid") || n.includes("email");
}

/** Recursive anonymization for council snapshots before external LLM. */
export function anonymizeCouncilPayload(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (/^\d{10}$/.test(t.replace(/\D/g, "").slice(-10))) {
      return MASKED;
    }
    if (t.includes("@")) return MASKED;
    if (/^\+?\d{9,15}$/.test(t.replace(/\s/g, ""))) return MASKED;
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => anonymizeCouncilPayload(item));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isCouncilSensitiveKey(k)) {
      out[k] = MASKED;
    } else {
      out[k] = anonymizeCouncilPayload(v);
    }
  }
  return out;
}
