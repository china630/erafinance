"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../../lib/audit-hub-api";
import { useRequireAuth } from "../../../../lib/use-require-auth";

type EngagementDetail = {
  id: string;
  title: string;
  status: string;
  periodFrom: string | null;
  periodTo: string | null;
  sampleIds: unknown;
  createdAt: string;
  createdByUserId: string;
};

export default function AuditEngagementDetailPage() {
  const { t } = useTranslation();
  useRequireAuth();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [row, setRow] = useState<EngagementDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    const res = await auditHubFetch(`/api/audit-hub/engagements/${encodeURIComponent(id)}`);
    if (!res.ok) {
      setErr(await res.text());
      setRow(null);
      return;
    }
    setRow((await res.json()) as EngagementDetail);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Link href="/audit-hub/engagements" className="text-xs font-semibold text-[#2980B9] hover:underline">
        ← {t("auditHub.engagementsBackList")}
      </Link>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {row ? (
        <div className="rounded-xl border border-[#D5DADF] bg-white p-4 text-sm shadow-sm">
          <h2 className="text-lg font-bold text-[#34495E]">{row.title}</h2>
          <dl className="mt-3 space-y-1 text-xs text-[#34495E]">
            <div>
              <dt className="font-semibold text-[#95A5A6]">ID</dt>
              <dd className="font-mono">{row.id}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#95A5A6]">{t("auditHub.engagementsStatus")}</dt>
              <dd>{row.status}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#95A5A6]">{t("auditHub.engagementsPeriod")}</dt>
              <dd>
                {row.periodFrom ? String(row.periodFrom).slice(0, 10) : "—"} —{" "}
                {row.periodTo ? String(row.periodTo).slice(0, 10) : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#95A5A6]">{t("auditHub.engagementsSamples")}</dt>
              <dd className="break-all font-mono text-[11px]">
                {JSON.stringify(row.sampleIds ?? [])}
              </dd>
            </div>
          </dl>
        </div>
      ) : !err ? (
        <p className="text-xs text-[#7F8C8D]">{t("auditHub.engagementsLoading")}</p>
      ) : null}
    </div>
  );
}
