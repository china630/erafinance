/**
 * Public marketing and auth routes — shared by middleware and client guards.
 * Keep in sync with `app/layout.tsx` bare-shell list where applicable.
 */
export function isPublicWebPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname === "/register") return true;
  if (pathname === "/register-org") return true;
  if (pathname === "/help") return true;
  if (pathname === "/pricing") return true;
  if (pathname.startsWith("/dispute/")) return true;
  if (pathname.startsWith("/verify/")) return true;
  if (pathname.startsWith("/billing/")) return true;
  if (pathname.startsWith("/portal")) return true;
  if (pathname.startsWith("/api/")) return true;
  return false;
}

/** Routes rendered without ERP `AppShell` chrome. */
export function isBarePublicWebPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/help") return true;
  if (pathname === "/pricing") return true;
  if (pathname.startsWith("/portal")) return true;
  if (pathname.startsWith("/verify/")) return true;
  if (pathname.startsWith("/dispute/")) return true;
  return false;
}
