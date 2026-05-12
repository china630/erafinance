import { CustomsDeclarationFullPrefillCaptureSchema } from "@erafinance/api-contracts";
import { MSG } from "../../shared/messages";
import { parseOpenBgdPage } from "./flows/bgd-capture";

export type CustomsCaptureResponse = {
  id: string;
  deduplicated?: boolean;
  mismatchPctDuty?: number;
  mismatchPctVat?: number;
};

export async function sendCustomsBgdCapture(
  doc: Document,
  portalVoen: string | null,
): Promise<CustomsCaptureResponse> {
  const fullPrefill = parseOpenBgdPage(doc);
  const voen =
    portalVoen && /^\d{10}$/.test(portalVoen) ? portalVoen : undefined;
  const capture = CustomsDeclarationFullPrefillCaptureSchema.parse({
    ...fullPrefill,
    portalVoen: voen ?? null,
    source: "WIDGET",
    capturedAt: new Date().toISOString(),
  });
  const raw = await new Promise<unknown>((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: MSG.PORTAL_PREFILL, flow: "customs" as const, capture },
      (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!res?.ok) reject(new Error(res?.error ?? "capture failed"));
        else resolve(res.data);
      },
    );
  });
  return raw as CustomsCaptureResponse;
}
