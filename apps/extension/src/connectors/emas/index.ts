import type { PortalConnector, PortalFlowDescriptor } from "../types";
import { detectEmasActiveVoen, detectEmasAuthState } from "./auth-detect";

export const emasConnector: PortalConnector = {
  id: "emas",
  entitlement: "hr_full",
  matches(url: URL) {
    return url.hostname.includes("emas.sosial.gov.az");
  },
  detectAuthState(doc: Document) {
    return detectEmasAuthState(doc);
  },
  async detectActiveVoen(doc: Document) {
    return detectEmasActiveVoen(doc);
  },
  listFlows(_url: URL): PortalFlowDescriptor[] {
    return [
      {
        id: "e-muqavile",
        titleKey: "extension.portal.flowEmuqavile",
        entitlement: "hr_full",
      },
    ];
  },
};
