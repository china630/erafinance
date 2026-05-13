/**
 * PII helpers for Prisma seeds only — same algorithm as
 * `prisma/scripts/ops/pii/data-migrate-org-tax-id-cipher.ts` so local API can decrypt VÖEN.
 */
import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const VERSION = "v1";

function resolveKey(primaryName: string, fallbackName = "JWT_SECRET"): Buffer {
  const raw = process.env[primaryName]?.trim();
  if (raw) {
    const asB64 = Buffer.from(raw, "base64");
    if (asB64.length >= 32) return createHash("sha256").update(asB64).digest();
    return createHash("sha256").update(raw).digest();
  }
  const fallback = process.env[fallbackName] ?? "erafinance-dev-fallback";
  return createHash("sha256").update(`${primaryName}:${fallback}`).digest();
}

export function normalizeVoenForSeed(value: string): string {
  return value.replace(/\D/g, "");
}

export function blindIndexVoenForSeed(value: string): string {
  const key = resolveKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key).update(`voen:${normalizeVoenForSeed(value)}`).digest("hex");
}

export function encryptVoenForSeed(value: string): string {
  const key = resolveKey("PII_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const normalized = normalizeVoenForSeed(value);
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}
