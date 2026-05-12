import { ConfigService } from "@nestjs/config";

/** База для QR на подписанных PDF: https://erp.example.com/verify/[logId] */
export function verifyQrPublicBase(config: ConfigService): string {
  const raw = config.get<string>("VERIFY_PUBLIC_BASE_URL");
  if (raw?.trim()) return raw.replace(/\/$/, "");
  return "https://erp.example.com";
}
