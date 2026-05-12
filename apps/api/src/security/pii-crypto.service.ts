import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const VERSION = "v1";

function toBase64Url(input: Buffer): string {
  return input.toString("base64url");
}

@Injectable()
export class PiiCryptoService {
  constructor(private readonly config: ConfigService) {}

  private resolveKey(
    primaryName: string,
    fallbackSecretName: string = "JWT_SECRET",
  ): Buffer {
    const raw = this.config.get<string>(primaryName)?.trim();
    if (raw) {
      // Accept either base64 / base64url or plain text secret.
      const asB64 = Buffer.from(raw, "base64");
      if (asB64.length >= 32) return createHash("sha256").update(asB64).digest();
      return createHash("sha256").update(raw).digest();
    }
    const fallback = this.config.get<string>(fallbackSecretName) ?? "erafinance-dev-fallback";
    return createHash("sha256").update(`${primaryName}:${fallback}`).digest();
  }

  normalizeVoen(value: string): string {
    return value.replace(/\D/g, "");
  }

  blindIndexForVoen(value: string): string {
    const normalized = this.normalizeVoen(value);
    const key = this.resolveKey("PII_BLIND_INDEX_KEY");
    return createHmac("sha256", key).update(`voen:${normalized}`).digest("hex");
  }

  encryptVoen(value: string): string {
    const normalized = this.normalizeVoen(value);
    const key = this.resolveKey("PII_ENCRYPTION_KEY");
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALG, key, iv);
    const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, toBase64Url(iv), toBase64Url(ciphertext), toBase64Url(tag)].join(".");
  }
}
