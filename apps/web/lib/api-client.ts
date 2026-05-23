import { ACCESS_TOKEN_KEY, ORGS_KEY, USER_KEY } from "./session-keys";
import { isPublicWebPath } from "./public-routes";

/**
 * В браузере — относительный origin (`/api/...`), чтобы запросы шли через Next rewrites на бэкенд.
 * На сервере (RSC и т.п.) — прямой URL API.
 */
export function apiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
}

function parseApiErrorMessage(text: string): string {
  const trimmed = text.trim().slice(0, 800);
  if (!trimmed) return "";
  try {
    const j = JSON.parse(trimmed) as unknown;
    if (!j || typeof j !== "object") return trimmed;
    const o = j as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (Array.isArray(o.message) && o.message.every((x) => typeof x === "string")) {
      return o.message.join("; ");
    }
    if (typeof o.error === "string") return o.error;
    if (o.message && typeof o.message === "object" && o.message !== null) {
      const m = o.message as Record<string, unknown>;
      if (typeof m.message === "string") return m.message;
    }
  } catch {
    /* not JSON */
  }
  return trimmed;
}

async function emitApiErrorToast(res: Response): Promise<void> {
  try {
    const text = await res.clone().text();
    const message = parseApiErrorMessage(text) || `HTTP ${res.status}`;
    window.dispatchEvent(
      new CustomEvent("erafinance:api-error", {
        detail: { status: res.status, message },
      }),
    );
  } catch {
    window.dispatchEvent(
      new CustomEvent("erafinance:api-error", {
        detail: { status: res.status, message: `HTTP ${res.status}` },
      }),
    );
  }
}

/** Same event as {@link emitApiErrorToast} for failures without a `Response` (e.g. network). */
export function emitClientApiError(status: number, message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("erafinance:api-error", {
      detail: { status, message },
    }),
  );
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  const url = path.startsWith("http") ? path : `${apiBaseUrl()}${path}`;

  return fetch(url, {
    ...init,
    headers,
    credentials: "include",
  }).then(async (res) => {
    const method = (init.method ?? "GET").toUpperCase();
    const pathOnly = (() => {
      try {
        if (path.startsWith("http")) {
          return new URL(path).pathname;
        }
        return (path.split("?")[0] ?? path).trim();
      } catch {
        return path;
      }
    })();
    const normalizedPath = pathOnly.replace(/\/+$/, "") || pathOnly;
    const isAuthLoginPost =
      method === "POST" &&
      (normalizedPath === "/api/auth/login" || normalizedPath.endsWith("/api/auth/login"));

    if (res.status === 401 && typeof window !== "undefined") {
      if (isAuthLoginPost) {
        // Wrong password / invalid credentials — do not redirect (user is already on /login).
        // Clear stale session keys so the next attempt does not send a bad Bearer token.
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(ORGS_KEY);
      } else if (headers.has("Authorization")) {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(ORGS_KEY);
        const currentPath = window.location.pathname;
        if (!isPublicWebPath(currentPath)) {
          window.location.replace("/login");
        }
      }
    }
    let skipApiErrorToast = false;
    if (res.status === 403 && typeof window !== "undefined") {
      const clone = res.clone();
      try {
        const data: unknown = await clone.json();
        if (
          data &&
          typeof data === "object" &&
          "code" in data &&
          (data as { code?: string }).code === "SUBSCRIPTION_READ_ONLY"
        ) {
          skipApiErrorToast = true;
          window.dispatchEvent(
            new CustomEvent("erafinance:subscription-read-only", {
              detail: data,
            }),
          );
        }
        if (
          data &&
          typeof data === "object" &&
          "code" in data &&
          (data as { code?: string }).code === "MODULE_NOT_ENTITLED"
        ) {
          skipApiErrorToast = true;
        }
      } catch {
        /* ignore */
      }
    }
    if (res.status === 402 && typeof window !== "undefined") {
      const clone = res.clone();
      try {
        const data: unknown = await clone.json();
        const code =
          data && typeof data === "object" && "code" in data
            ? (data as { code?: string }).code
            : undefined;
        if (
          code === "QUOTA_EXCEEDED" ||
          code === "CREDIT_HARD_LOCK" ||
          code === "USAGE_CAP_EXCEEDED"
        ) {
          skipApiErrorToast = true;
          window.dispatchEvent(
            new CustomEvent("erafinance:quota-upgrade", { detail: data }),
          );
        }
      } catch {
        /* ignore */
      }
    }
    const isRead = method === "GET" || method === "HEAD";
    if (
      typeof window !== "undefined" &&
      res.status >= 400 &&
      !skipApiErrorToast &&
      !isRead &&
      (res.status !== 401 || isAuthLoginPost)
    ) {
      void emitApiErrorToast(res);
    }
    return res;
  });
}

/**
 * POST with `keepalive` for `pagehide` / unmount (includes Authorization header).
 * Fire-and-forget; errors are swallowed by the browser on unload.
 */
export function apiPostKeepalive(path: string, body: unknown): void {
  if (typeof window === "undefined") return;
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = path.startsWith("http") ? path : `${apiBaseUrl()}${path}`;
  void fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    keepalive: true,
    credentials: "include",
  });
}
