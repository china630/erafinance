"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../lib/audit-hub-api";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "../../lib/design-system";
import { useRequireAuth } from "../../lib/use-require-auth";

type Summary = {
  auditNotesLast30Days: number;
  samplesLast30Days: number;
  auditMutationsLast30Days: number;
  backdatedCandidates: number;
};

export default function AuditHubDashboardPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const res = await auditHubFetch("/api/audit-hub/summary");
    if (!res.ok) {
      setErr(t("auditHub.summaryLoadErr"));
      return;
    }
    const body = (await res.json()) as Summary;
    setSummary(body);
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  if (!ready || !token) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className={`${CARD_CONTAINER_CLASS} grid gap-4 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("auditHub.summaryNotes")}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#2C3E50]">
            {summary?.auditNotesLast30Days ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("auditHub.summarySamples")}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#2C3E50]">
            {summary?.samplesLast30Days ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("auditHub.summaryMutations")}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#2C3E50]">
            {summary?.auditMutationsLast30Days ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("auditHub.summaryBackdating")}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#2C3E50]">
            {summary?.backdatedCandidates ?? "—"}
          </div>
        </div>
      </div>

      {err ? (
        <p className="text-sm text-red-600">{err}</p>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2`}>
        <Link href="/audit-hub/timeline" className={PRIMARY_BUTTON_CLASS}>
          {t("auditHub.navTimeline")}
        </Link>
        <Link href="/audit-hub/sampling" className={PRIMARY_BUTTON_CLASS}>
          {t("auditHub.navSampling")}
        </Link>
        <Link href="/audit-hub/backdating" className={PRIMARY_BUTTON_CLASS}>
          {t("auditHub.navBackdating")}
        </Link>
        <Link href="/audit-hub/bulk-export" className={PRIMARY_BUTTON_CLASS}>
          {t("auditHub.navBulkExport")}
        </Link>
        <Link href="/audit-hub/reconciliation" className={PRIMARY_BUTTON_CLASS}>
          {t("auditHub.navReconciliation")}
        </Link>
        <Link href="/audit-hub/risk" className={PRIMARY_BUTTON_CLASS}>
          {t("auditHub.navRisk")}
        </Link>
        <Link href="/audit-hub/calculation" className={PRIMARY_BUTTON_CLASS}>
          {t("auditHub.navCalculation")}
        </Link>
        <Link href="/audit-hub/engagements" className={PRIMARY_BUTTON_CLASS}>
          {t("auditHub.navEngagements")}
        </Link>
      </div>
    </div>
  );
}
