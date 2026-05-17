"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../lib/audit-hub-api";
import { CARD_CONTAINER_CLASS } from "../../lib/design-system";
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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("auditHub.summaryNotes")}
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#34495E]">
            {summary?.auditNotesLast30Days ?? "—"}
          </div>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("auditHub.summarySamples")}
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#34495E]">
            {summary?.samplesLast30Days ?? "—"}
          </div>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("auditHub.summaryMutations")}
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#34495E]">
            {summary?.auditMutationsLast30Days ?? "—"}
          </div>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("auditHub.summaryBackdating")}
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#34495E]">
            {summary?.backdatedCandidates ?? "—"}
          </div>
        </div>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
