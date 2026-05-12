import { parseExtensionRefresh, apiFetch } from "../shared/api-client";
import { apiBaseUrl, erpOriginDefault } from "../shared/config";
import { setAccessSession, clearAccessSession } from "../shared/session-store";
import {
  getErpOrigin,
  setErpOrigin,
  setActiveOrganizationId,
  getActiveOrganizationId,
} from "../shared/local-store";
import { MSG } from "../shared/messages";

const ERP_TAB_MATCH =
  /https:\/\/erp\.example\.com\/.*|http:\/\/localhost:3000\/.*|http:\/\/127\.0\.0\.1:3000\/.*/;

async function silentRefreshFromErpOrigin(): Promise<boolean> {
  const origin = (await getErpOrigin()) ?? erpOriginDefault();
  const url = `${origin}/api/auth/extension/refresh`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    mode: "cors",
  });
  const text = await res.text();
  if (!res.ok) return false;
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return false;
  }
  const parsed = parseExtensionRefresh(body);
  await setAccessSession(parsed.accessToken, parsed.expiresAt);
  if (parsed.user.organizationId) {
    await setActiveOrganizationId(parsed.user.organizationId);
  }
  return true;
}

async function magicHandshakeViaTab(): Promise<boolean> {
  const tabs = await browser.tabs.query({ url: ERP_TAB_MATCH });
  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      const reply = (await browser.tabs.sendMessage(tab.id, {
        type: MSG.ERP_HANDSHAKE,
      })) as { ok?: boolean; error?: string; payload?: unknown };
      if (reply?.ok && reply.payload) {
        const parsed = parseExtensionRefresh(reply.payload);
        await setAccessSession(parsed.accessToken, parsed.expiresAt);
        if (tab.url) {
          try {
            await setErpOrigin(new URL(tab.url).origin);
          } catch {
            /* ignore */
          }
        }
        if (parsed.user.organizationId) {
          await setActiveOrganizationId(parsed.user.organizationId);
        }
        return true;
      }
    } catch {
      /* tab has no content script or bridge not ready */
    }
  }
  return false;
}

export async function requestMagicAuth(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (await silentRefreshFromErpOrigin()) {
    return { ok: true };
  }
  if (await magicHandshakeViaTab()) {
    return { ok: true };
  }
  return { ok: false, error: "ERP tab or session not available" };
}

export async function logoutExtension(): Promise<void> {
  await clearAccessSession();
  try {
    await fetch(`${apiBaseUrl()}/api/auth/extension/logout`, {
      method: "POST",
      credentials: "include",
      mode: "cors",
    });
  } catch {
    /* ignore */
  }
}

export async function switchOrganization(organizationId: string): Promise<void> {
  const out = await apiFetch<{ accessToken: string }>("/api/auth/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId }),
  });
  await setAccessSession(out.accessToken);
  await setActiveOrganizationId(organizationId);
}

export async function getAuthSnapshot(): Promise<unknown> {
  return apiFetch<unknown>("/api/auth/me");
}

export async function getSubscriptionSnapshot(): Promise<unknown> {
  return apiFetch<unknown>("/api/subscription/me");
}

export async function getEmployeePrefill(employeeId: string): Promise<unknown> {
  const org = await getActiveOrganizationId();
  return apiFetch<unknown>(`/api/hr/employees/${employeeId}/prefill`, {
    organizationId: org,
  });
}

export async function getInvoicePrefill(invoiceId: string): Promise<unknown> {
  const org = await getActiveOrganizationId();
  return apiFetch<unknown>(`/api/invoices/${invoiceId}/prefill`, {
    organizationId: org,
  });
}

export async function getEmployeesBulkPrefill(employeeIds: string[]): Promise<unknown> {
  const org = await getActiveOrganizationId();
  return apiFetch<unknown>("/api/hr/employees/bulk-prefill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeIds }),
    organizationId: org,
  });
}

export async function getInvoicesBulkPrefill(invoiceIds: string[]): Promise<unknown> {
  const org = await getActiveOrganizationId();
  return apiFetch<unknown>("/api/invoices/bulk-prefill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceIds }),
    organizationId: org,
  });
}

export async function reportEmployeesBulkResult(payload: {
  runId: string;
  items: Array<{
    employeeId: string;
    status: "SYNCED" | "ERROR";
    externalId?: string | null;
    error?: string | null;
  }>;
}): Promise<unknown> {
  const org = await getActiveOrganizationId();
  return apiFetch<unknown>("/api/hr/employees/bulk-sync-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    organizationId: org,
  });
}

export async function postCustomsCapture(payload: unknown): Promise<unknown> {
  const org = await getActiveOrganizationId();
  return apiFetch<unknown>("/api/customs/declarations/prefill-capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    organizationId: org,
  });
}

export async function reportInvoicesBulkResult(payload: {
  runId: string;
  items: Array<{
    invoiceId: string;
    status: "SYNCED" | "ERROR";
    externalId?: string | null;
    error?: string | null;
  }>;
}): Promise<unknown> {
  const org = await getActiveOrganizationId();
  return apiFetch<unknown>("/api/invoices/bulk-sync-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    organizationId: org,
  });
}
