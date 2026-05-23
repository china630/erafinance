import type { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE_KEY } from "./session-keys";

export { ACCESS_TOKEN_COOKIE_KEY };

export type AccessTokenEdgeState = "missing" | "invalid" | "valid";

/** Lightweight JWT shape + expiry check for Next middleware (no signature verification). */
export function getAccessTokenEdgeState(token: string | undefined): AccessTokenEdgeState {
  if (!token?.trim()) return "missing";

  const parts = token.split(".");
  if (parts.length !== 3) return "invalid";

  try {
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      payloadB64.length % 4 === 0
        ? payloadB64
        : payloadB64 + "=".repeat(4 - (payloadB64.length % 4));
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    const exp = typeof json.exp === "number" ? json.exp : null;
    if (exp && Date.now() >= exp * 1000) return "invalid";
    return "valid";
  } catch {
    return "invalid";
  }
}

export function clearAccessTokenCookie(res: NextResponse): void {
  res.cookies.set(ACCESS_TOKEN_COOKIE_KEY, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
}
