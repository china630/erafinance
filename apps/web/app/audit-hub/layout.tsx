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
    tier !== "TIER_3" && !effectiveSnapshot?.modules.auditHub;
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

  const isDashboard = pathname === "/audit-hub";
  const activeSectionLabel =
    tabs.find((tab) => tab.href !== "/audit-hub" && pathname.startsWith(tab.href))?.label ??
    t("auditHub.dashboardTitle");

  return (
    <div className="space-y-4">
      {isDashboard ? (
        <>
          <h1 className="m-0 text-2xl font-semibold text-[#34495E]">{t("auditHub.dashboardTitle")}</h1>
          <p className="m-0 mt-2 text-sm text-[#7F8C8D]">{t("auditHub.dashboardSubtitle")}</p>
        </>
      ) : (
        <div>
          <h1 className="m-0 text-2xl font-semibold text-[#34495E]">{activeSectionLabel}</h1>
          <p className="m-0 mt-2 text-sm text-[#7F8C8D]">{t("auditHub.sectionContextHint")}</p>
        </div>
      )}

      {probingGuest ? (
        <div className="rounded-2xl border border-[#D5DADF] bg-[#EBEDF0]/60 px-4 py-3 text-[13px] text-[#34495E]">
          {t("auditHub.guestSessionChecking")}
        </div>
      ) : null}

      {locked ? (
        <div className="rounded-2xl border border-[#D5DADF] bg-[#FFFBF0] px-4 py-3 text-[13px] text-[#34495E]">
          {t("auditHub.paywall")}
        </div>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2 border-b border-[#D5DADF] pb-2">
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
                    "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition",
                    active
                      ? "border-[#2980B9] bg-white text-[#34495E] shadow-sm"
                      : "border-transparent text-[#7F8C8D] hover:border-[#D5DADF]",
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

