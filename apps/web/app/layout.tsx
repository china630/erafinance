import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { Providers } from "./providers";
import { AppShell } from "./app-shell";
import { ExtensionBridge } from "../components/extension-bridge";
import { isBarePublicWebPath, isPublicWebPath } from "../lib/public-routes";

/** Auth and pathname come from middleware; avoid stale static layout without `x-erafinance-pathname`. */
export const dynamic = "force-dynamic";

/** SSR fallback; locale-specific title/description are applied in `SeoHeadSync` (Providers). */
export const metadata: Metadata = {
  title: "ERA Finance",
  description: "SaaS-учёт для бизнеса в Азербайджане / Azərbaycan üçün SaaS uçot",
};
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const token = cookieStore.get("erafinance_access_token")?.value;
  const pathname = headerStore.get("x-erafinance-pathname") ?? "";
  const publicPath = isPublicWebPath(pathname);
  const barePublicLayout = isBarePublicWebPath(pathname);

  return (
    <html lang="az" suppressHydrationWarning>
      <body style={{ fontFamily: "system-ui", margin: 0 }}>
        <ExtensionBridge />
        <Providers>
          {barePublicLayout || (publicPath && !token) ? (
            children
          ) : (
            <Suspense fallback={<div className="min-h-screen bg-[#EBEDF0]" />}>
              <AppShell>{children}</AppShell>
            </Suspense>
          )}
        </Providers>
      </body>
    </html>
  );
}
