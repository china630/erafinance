import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { Providers } from "./providers";
import { AppShell } from "./app-shell";
import LoginPage from "./login/page";
import { ExtensionBridge } from "../components/extension-bridge";

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
  const portalPath = pathname.startsWith("/portal");
  const publicPath =
    pathname === "/" ||
    pathname === "/home" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/register-org" ||
    pathname === "/help" ||
    pathname === "/pricing" ||
    pathname.startsWith("/verify/") ||
    pathname.startsWith("/dispute/") ||
    portalPath;
  /** Portal, email verify, dispute, help, pricing, marketing landing — no `AppShell` chrome. */
  const barePublicLayout =
    portalPath ||
    pathname.startsWith("/verify/") ||
    pathname.startsWith("/dispute/") ||
    pathname === "/help" ||
    pathname === "/pricing" ||
    pathname === "/";

  return (
    <html lang="az" suppressHydrationWarning>
      <body style={{ fontFamily: "system-ui", margin: 0 }}>
        <ExtensionBridge />
        <Providers>
          {!token && !publicPath ? (
            <LoginPage />
          ) : barePublicLayout ? (
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
