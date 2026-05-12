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
function normalizeFin(value: string): string {
  return value.trim().toUpperCase();
}
function normalizeName(value: string): string {
  return value.trim();
}
function blindIndex(kind: "voen" | "fin", value: string): string {
  const key = resolveKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key).update(`${kind}:${value}`).digest("hex");
}
function encryptText(value: string): string {
  const key = resolveKey("PII_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

async function main() {
  const prisma = createPrismaClient();
  try {
    const employees = await prisma.$queryRaw<
      Array<{ id: string; fin_code: string; first_name: string; last_name: string }>
    >`SELECT id, fin_code, first_name, last_name FROM employees`;
    for (const e of employees) {
      const fin = normalizeFin(e.fin_code);
      await prisma.$executeRaw`
        UPDATE employees
        SET fin_code_cipher = ${encryptText(fin)},
            fin_code_blind_index = ${blindIndex("fin", fin)},
            first_name_cipher = ${encryptText(normalizeName(e.first_name))},
            last_name_cipher = ${encryptText(normalizeName(e.last_name))}
        WHERE id = ${e.id}
      `;
    }

    const counterparties = await prisma.$queryRaw<
      Array<{ id: string; tax_id: string; name: string }>
    >`SELECT id, tax_id, name FROM counterparties`;
    for (const c of counterparties) {
      const voen = normalizeVoen(c.tax_id);
      await prisma.$executeRaw`
        UPDATE counterparties
        SET tax_id_cipher = ${encryptText(voen)},
            tax_id_blind_index = ${blindIndex("voen", voen)},
            name_cipher = ${encryptText(normalizeName(c.name))}
        WHERE id = ${c.id}
      `;
    }

    const users = await prisma.$queryRaw<
      Array<{ id: string; first_name: string | null; last_name: string | null }>
    >`SELECT id, first_name, last_name FROM users`;
    for (const u of users) {
      const derivedFullName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
      await prisma.$executeRaw`
        UPDATE users
        SET first_name_cipher = ${u.first_name ? encryptText(normalizeName(u.first_name)) : null},
            last_name_cipher = ${u.last_name ? encryptText(normalizeName(u.last_name)) : null},
            full_name_cipher = ${derivedFullName ? encryptText(normalizeName(derivedFullName)) : null}
        WHERE id = ${u.id}
      `;
    }

    console.info(
      `[pii-stage3] employees=${employees.length}, counterparties=${counterparties.length}, users=${users.length}`,
    );
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

main().catch((e) => {
  console.error("[pii-stage3] failed", e);
  process.exit(1);
});
