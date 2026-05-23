import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE_KEY,
  clearAccessTokenCookie,
  getAccessTokenEdgeState,
} from "./lib/access-token-edge";
import { ERAFINANCE_MAINTENANCE_HTML } from "./lib/maintenance-page-html";
import { isPublicWebPath } from "./lib/public-routes";

/** Bracket access: improves chance the value is read at runtime (not inlined at build) under `next start`. */
function maintenanceModeEnabled(): boolean {
  const raw = process.env["MAINTENANCE_MODE"]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function isSkippableAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

function redirectToLogin(req: NextRequest, pathname: string, clearCookie: boolean): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  const res = NextResponse.redirect(url);
  if (clearCookie) clearAccessTokenCookie(res);
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-erafinance-pathname", pathname);

  if (isSkippableAssetPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (maintenanceModeEnabled()) {
    return new NextResponse(ERAFINANCE_MAINTENANCE_HTML, {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "120",
      },
    });
  }

  const rawToken = req.cookies.get(ACCESS_TOKEN_COOKIE_KEY)?.value;
  const tokenState = getAccessTokenEdgeState(rawToken);

  if (pathname === "/") {
    if (tokenState === "valid") {
      const url = req.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (tokenState === "invalid") clearAccessTokenCookie(res);
    return res;
  }

  if (isPublicWebPath(pathname)) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (tokenState === "invalid") clearAccessTokenCookie(res);
    return res;
  }

  if (tokenState !== "valid") {
    return redirectToLogin(req, pathname, tokenState === "invalid");
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)"],
};
