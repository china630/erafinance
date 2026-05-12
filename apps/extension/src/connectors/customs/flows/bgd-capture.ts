import type { CustomsDeclarationFullPrefill } from "@erafinance/api-contracts";
import { mapDomToFullPrefill } from "../adapters/portal-to-bgd";

export type BgdCaptureFlow = {
  id: "bgd-capture";
  titleKey: string;
};

export const bgdCaptureFlow: BgdCaptureFlow = {
  id: "bgd-capture",
  titleKey: "extension.portal.flowBgdCapture",
};

/** Full BGD prefill (header + line items, or synthetic single line). */
export function parseOpenBgdPage(doc: Document): CustomsDeclarationFullPrefill {
  return mapDomToFullPrefill(doc);
}
