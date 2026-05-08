/** API base (Nest), no trailing slash. */
export function apiBaseUrl(): string {
  const u = import.meta.env.WXT_PUBLIC_API_URL as string | undefined;
  return (u ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

/** ERP web origin for credentialed extension refresh (cookies on this host). */
export function erpOriginDefault(): string {
  const u = import.meta.env.WXT_PUBLIC_ERP_ORIGIN as string | undefined;
  return (u ?? "http://localhost:3000").replace(/\/$/, "");
}
