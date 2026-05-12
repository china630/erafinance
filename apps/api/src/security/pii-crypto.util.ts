import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const VERSION = "v1";

function resolveKey(primaryName: string, fallbackSecretName = "JWT_SECRET"): Buffer {
  const raw = process.env[primaryName]?.trim();
  if (raw) {
    const asB64 = Buffer.from(raw, "base64");
    if (asB64.length >= 32) return createHash("sha256").update(asB64).digest();
    return createHash("sha256").update(raw).digest();
  }
  const fallback = process.env[fallbackSecretName] ?? "erafinance-dev-fallback";
  return createHash("sha256").update(`${primaryName}:${fallback}`).digest();
}

export function normalizeVoen(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeFin(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeName(value: string): string {
  return value.trim();
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function placeholderOrgTaxId(voen: string): string {
  return `__enc__org__${shortHash(normalizeVoen(voen))}`;
}

export function placeholderEmployeeFin(fin: string): string {
  return `__enc__fin__${shortHash(normalizeFin(fin))}`;
}

export function placeholderEmployeeFirstName(name: string): string {
  return `__enc__fn__${shortHash(normalizeName(name))}`;
}

export function placeholderEmployeeLastName(name: string): string {
  return `__enc__ln__${shortHash(normalizeName(name))}`;
}

export function placeholderCounterpartyTaxId(voen: string): string {
  return `__enc__cp__${shortHash(normalizeVoen(voen))}`;
}

export function placeholderCounterpartyName(name: string): string {
  return `__enc__name__${shortHash(normalizeName(name))}`;
}



export function blindIndex(kind: "voen" | "fin", value: string): string {
  const normalized =
    kind === "voen" ? normalizeVoen(value) : normalizeFin(value);
  const key = resolveKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key).update(`${kind}:${normalized}`).digest("hex");
}

export function encryptText(value: string): string {
  const key = resolveKey("PII_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function decryptText(cipherPayload: string): string | null {
  try {
    const [version, ivB64, bodyB64, tagB64] = cipherPayload.split(".");
    if (version !== VERSION || !ivB64 || !bodyB64 || !tagB64) {
      return null;
    }
    const key = resolveKey("PII_ENCRYPTION_KEY");
    const iv = Buffer.from(ivB64, "base64url");
    const body = Buffer.from(bodyB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(body), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

export function decodeOrganizationTaxId(
  org: { taxIdCipher?: string | null } | null | undefined,
): string {
  if (!org?.taxIdCipher) return "";
  return decryptText(org.taxIdCipher) ?? "";
}
