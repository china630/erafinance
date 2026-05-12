import type { ModuleEntitlementKey } from "@erafinance/api-contracts";

export type PortalId = "etaxes" | "emas" | "customs";

export type AuthState = "anonymous" | "authenticated" | "unknown";

export type PortalFlowDescriptor = {
  id: string;
  titleKey: string;
  entitlement: ModuleEntitlementKey;
};

export type PortalConnector = {
  readonly id: PortalId;
  readonly entitlement: ModuleEntitlementKey;
  matches(url: URL): boolean;
  detectAuthState(doc: Document): AuthState;
  detectActiveVoen(doc: Document): Promise<string | null>;
  listFlows(_url: URL): PortalFlowDescriptor[];
};
