import {
  ExtensionRefreshResponseSchema,
  type ExtensionRefreshResponse,
} from "@erafinance/api-contracts";
import { apiBaseUrl } from "./config";
import { getAccessToken, clearAccessSession } from "./session-store";
import { getActiveOrganizationId } from "./local-store";

export type ApiFetchOptions = RequestInit & {
  /** Skip Bearer (public routes). */
  skipAuth?: boolean;
  /** Override X-Organization-Id (otherwise from storage). */
  organizationId?: string | null;
};

export async function apiFetch<T>(
  path: string,
  init: ApiFetchOptions = {},
): Promise<T> {
  const { skipAuth, organizationId: orgOverride, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const orgId =
    orgOverride !== undefined ? orgOverride : await getActiveOrganizationId();
  if (orgId) headers.set("X-Organization-Id", orgId);

  const url = `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...rest, headers });

  if (res.status === 401 && !skipAuth) {
    await clearAccessSession();
  }

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export function parseExtensionRefresh(body: unknown): ExtensionRefreshResponse {
  return ExtensionRefreshResponseSchema.parse(body);
}
