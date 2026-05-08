/** Popup / content script ↔ background protocol. */
export const MSG = {
  AUTH_REQUEST_MAGIC: "dayday:auth:requestMagic",
  AUTH_SNAPSHOT: "dayday:auth:snapshot",
  AUTH_SWITCH_ORG: "dayday:auth:switchOrg",
  AUTH_LOGOUT: "dayday:auth:logout",
  ENTITLEMENTS_GET: "dayday:entitlements:get",
  PORTAL_PREFILL: "dayday:portal:prefill",
  PORTAL_BULK_PREFILL: "dayday:portal:bulkPrefill",
  PORTAL_BULK_RESULT: "dayday:portal:bulkResult",
  ERP_HANDSHAKE: "dayday:erp:handshake",
  ERP_HANDSHAKE_RESULT: "dayday:erp:handshakeResult",
} as const;

export type PortalPrefillFlow = "emuqavile" | "eqaime" | "customs";

export type PortalPrefillMsg =
  | {
      type: typeof MSG.PORTAL_PREFILL;
      flow?: "emuqavile";
      employeeId: string;
    }
  | {
      type: typeof MSG.PORTAL_PREFILL;
      flow: "eqaime";
      invoiceId: string;
    }
  | {
      type: typeof MSG.PORTAL_PREFILL;
      flow: "customs";
      /** `CustomsDeclarationPrefillCapture` JSON */
      capture: unknown;
    };

export type PortalBulkPrefillMsg =
  | {
      type: typeof MSG.PORTAL_BULK_PREFILL;
      flow?: "emuqavile";
      employeeIds: string[];
    }
  | {
      type: typeof MSG.PORTAL_BULK_PREFILL;
      flow: "eqaime";
      invoiceIds: string[];
    };

export type PortalBulkResultMsg =
  | {
      type: typeof MSG.PORTAL_BULK_RESULT;
      flow?: "emuqavile";
      runId: string;
      items: Array<{
        employeeId: string;
        status: "SYNCED" | "ERROR";
        externalId?: string | null;
        error?: string | null;
      }>;
    }
  | {
      type: typeof MSG.PORTAL_BULK_RESULT;
      flow: "eqaime";
      runId: string;
      items: Array<{
        invoiceId: string;
        status: "SYNCED" | "ERROR";
        externalId?: string | null;
        error?: string | null;
      }>;
    };

export type AuthSnapshotMsg = {
  type: typeof MSG.AUTH_SNAPSHOT;
  ok: boolean;
  error?: string;
  data?: unknown;
};
