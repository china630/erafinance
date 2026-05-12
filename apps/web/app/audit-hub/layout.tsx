"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuditEngagementSession } from "../../lib/audit-engagement-session";
import {
  AUDIT_ENGAGEMENT_INVITE_ID_KEY,
  AUDIT_ENGAGEMENT_TOKEN_KEY,
} from "../../lib/session-keys";
import { useSubscription } from "../../lib/subscription-context";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function AuditHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  useRequireAuth();
  const { effectiveSnapshot } = useSubscription();
  const engagement = useAuditEngagementSession();
  const tier = effectiveSnapshot?.tier
    ? String(effectiveSnapshot.tier).toUpperCase()
    : "";
  const moduleLocked =
    tier !== "ENTERPRISE" && !effectiveSnapshot?.modules.auditHub;
  const guestUnlocked = engagement.phase === "active";
  const hasKeys =
    typeof window !== "undefined" &&
    Boolean(
      sessionStorage.getItem(AUDIT_ENGAGEMENT_INVITE_ID_KEY) &&
        sessionStorage.getItem(AUDIT_ENGAGEMENT_TOKEN_KEY),
    );
  const probingGuest = moduleLocked && hasKeys && engagement.phase === "unchecked";
  const locked = moduleLocked && !guestUnlocked && !probingGuest;

  const tabs = [
    { href: "/audit-hub", label: t("auditHub.navDashboard") },
    { href: "/audit-hub/timeline", label: t("auditHub.navTimeline") },
    { href: "/audit-hub/sampling", label: t("auditHub.navSampling") },
    { href: "/audit-hub/backdating", label: t("auditHub.navBackdating") },
    { href: "/audit-hub/bulk-export", label: t("auditHub.navBulkExport") },
    { href: "/audit-hub/reconciliation", label: t("auditHub.navReconciliation") },
    { href: "/audit-hub/risk", label: t("auditHub.navRisk") },
    { href: "/audit-hub/calculation", label: t("auditHub.navCalculation") },
    { href: "/audit-hub/engagements", label: t("auditHub.navEngagements") },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#2C3E50]">
          {t("auditHub.dashboardTitle")}
        </h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("auditHub.dashboardSubtitle")}</p>
      </div>

      {probingGuest ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {t("auditHub.guestSessionChecking")}
        </div>
      ) : null}

      {locked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("auditHub.paywall")}
        </div>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-2">
            {tabs.map((tab) => {
              const active =
                tab.href === "/audit-hub"
                  ? pathname === "/audit-hub"
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-[#7F8C8D] hover:bg-white hover:text-[#2C3E50]",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          {children}
        </>
      )}
    </div>
  );
}
