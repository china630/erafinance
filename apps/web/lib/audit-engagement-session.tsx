"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "./api-client";
import {
  AUDIT_ENGAGEMENT_INVITE_ID_KEY,
  AUDIT_ENGAGEMENT_TOKEN_KEY,
} from "./session-keys";

export type AuditEngagementPermissions = {
  auditHubRead?: boolean;
  auditNotesWrite?: boolean;
  auditBulkExport?: boolean;
};

export type AuditEngagementSession =
  | { phase: "unchecked" }
  | { phase: "none" }
  | {
      phase: "active";
      organizationId: string;
      organizationName: string;
      permissions: AuditEngagementPermissions;
    }
  | { phase: "invalid" };

type Ctx = {
  session: AuditEngagementSession;
  refresh: () => Promise<void>;
};

const AuditEngagementSessionContext = createContext<Ctx | null>(null);

function buildEngagementHeaders(): Headers {
  const headers = new Headers();
  if (typeof window === "undefined") return headers;
  const inviteId = sessionStorage.getItem(AUDIT_ENGAGEMENT_INVITE_ID_KEY);
  const token = sessionStorage.getItem(AUDIT_ENGAGEMENT_TOKEN_KEY);
  if (inviteId && token) {
    headers.set("x-audit-engagement-invite-id", inviteId);
    headers.set("x-audit-engagement-token", token);
  }
  return headers;
}

export function AuditEngagementSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuditEngagementSession>({ phase: "unchecked" });

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const inviteId = sessionStorage.getItem(AUDIT_ENGAGEMENT_INVITE_ID_KEY);
    const token = sessionStorage.getItem(AUDIT_ENGAGEMENT_TOKEN_KEY);
    if (!inviteId || !token) {
      setSession({ phase: "none" });
      return;
    }
    const res = await apiFetch("/api/audit-hub/me/audit-engagement/context", {
      headers: buildEngagementHeaders(),
    });
    if (res.status === 403 || !res.ok) {
      setSession({ phase: "invalid" });
      return;
    }
    const data = (await res.json()) as {
      active?: boolean;
      organizationId?: string;
      organizationName?: string;
      permissions?: AuditEngagementPermissions;
    };
    if (!data.active) {
      setSession({ phase: "none" });
      return;
    }
    setSession({
      phase: "active",
      organizationId: data.organizationId ?? "",
      organizationName: data.organizationName ?? "",
      permissions: data.permissions ?? {},
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ session, refresh }), [session, refresh]);

  return (
    <AuditEngagementSessionContext.Provider value={value}>
      {children}
    </AuditEngagementSessionContext.Provider>
  );
}

export function useAuditEngagementSession(): AuditEngagementSession & {
  refresh: () => Promise<void>;
} {
  const ctx = useContext(AuditEngagementSessionContext);
  if (!ctx) {
    throw new Error("useAuditEngagementSession requires AuditEngagementSessionProvider");
  }
  return { ...ctx.session, refresh: ctx.refresh };
}
