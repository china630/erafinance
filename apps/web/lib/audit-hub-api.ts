import { apiFetch } from "./api-client";
import {
  AUDIT_ENGAGEMENT_INVITE_ID_KEY,
  AUDIT_ENGAGEMENT_TOKEN_KEY,
} from "./session-keys";

/** Merges engagement headers when invite id + token are stored (external auditor session). */
export function auditHubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof window !== "undefined") {
    const inviteId = sessionStorage.getItem(AUDIT_ENGAGEMENT_INVITE_ID_KEY);
    const token = sessionStorage.getItem(AUDIT_ENGAGEMENT_TOKEN_KEY);
    if (inviteId && token) {
      headers.set("x-audit-engagement-invite-id", inviteId);
      headers.set("x-audit-engagement-token", token);
    }
  }
  return apiFetch(path, { ...init, headers });
}

export function hasStoredAuditEngagementKeys(): boolean {
  if (typeof window === "undefined") return false;
  const inviteId = sessionStorage.getItem(AUDIT_ENGAGEMENT_INVITE_ID_KEY);
  const token = sessionStorage.getItem(AUDIT_ENGAGEMENT_TOKEN_KEY);
  return Boolean(inviteId && token);
}
