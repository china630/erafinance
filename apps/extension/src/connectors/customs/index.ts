import type { PortalConnector, PortalFlowDescriptor } from "../types";
import { detectCustomsActiveVoen, detectCustomsAuthState } from "./auth-detect";
import { bgdCaptureFlow } from "./flows/bgd-capture";

export const customsConnector: PortalConnector = {
  id: "customs",
  entitlement: "trade_pro",
  matches(url: URL) {
    const h = url.hostname.toLowerCase();
    return h === "e-customs.gov.az" || h.endsWith(".customs.gov.az");
  },
  detectAuthState(doc: Document) {
    return detectCustomsAuthState(doc);
  },
  async detectActiveVoen(doc: Document) {
    return detectCustomsActiveVoen(doc);
  },
  listFlows(_url: URL): PortalFlowDescriptor[] {
    return [
      {
        id: bgdCaptureFlow.id,
        titleKey: bgdCaptureFlow.titleKey,
        entitlement: "trade_pro",
      },
    ];
  },
};
