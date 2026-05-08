import type { PortalConnector, PortalFlowDescriptor } from "../types";
import { detectEtaxesActiveVoen, detectEtaxesAuthState } from "./auth-detect";
import { eQaimeFlow } from "./flows/e-qaime";

export const etaxesConnector: PortalConnector = {
  id: "etaxes",
  entitlement: "tax_pro",
  matches(url: URL) {
    return (
      url.hostname === "new.e-taxes.gov.az" ||
      url.hostname === "login.e-taxes.gov.az" ||
      url.hostname.endsWith(".e-taxes.gov.az")
    );
  },
  detectAuthState(doc: Document) {
    return detectEtaxesAuthState(doc);
  },
  async detectActiveVoen(doc: Document) {
    return detectEtaxesActiveVoen(doc);
  },
  listFlows(_url: URL): PortalFlowDescriptor[] {
    return [eQaimeFlow];
  },
};
