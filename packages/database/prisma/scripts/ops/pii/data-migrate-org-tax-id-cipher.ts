import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { closePrismaPool, createPrismaClient } from "../../../prisma-client";

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

function normalizeVoen(value: string): string {
  return value.replace(/\D/g, "");
}

function blindIndexForVoen(value: string): string {
  const key = resolveKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key).update(`voen:${normalizeVoen(value)}`).digest("hex");
}

function encryptVoen(value: string): string {
  const key = resolveKey("PII_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(normalizeVoen(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

async function main() {
  const prisma = createPrismaClient();
  const batchSize = 500;
  let cursor: string | undefined;
  let updated = 0;
  try {
    for (;;) {
      const rows = cursor
        ? await prisma.$queryRaw<Array<{ id: string; tax_id: string }>>`
            SELECT id, tax_id
            FROM organizations
            WHERE id > ${cursor}
            ORDER BY id ASC
            LIMIT ${batchSize}
          `
        : await prisma.$queryRaw<Array<{ id: string; tax_id: string }>>`
            SELECT id, tax_id
            FROM organizations
            ORDER BY id ASC
            LIMIT ${batchSize}
          `;
      if (!rows.length) break;
      for (const row of rows) {
        await prisma.$executeRaw`
          UPDATE organizations
          SET tax_id_blind_index = ${blindIndexForVoen(row.tax_id)},
              tax_id_cipher = ${encryptVoen(row.tax_id)}
          WHERE id = ${row.id}
        `;
        updated += 1;
      }
      cursor = rows[rows.length - 1]?.id;
      console.info(`[org-tax-cipher] processed ${updated}`);
    }
    console.info(`[org-tax-cipher] done, updated=${updated}`);
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

main().catch((e) => {
  console.error("[org-tax-cipher] failed", e);
  process.exit(1);
});
