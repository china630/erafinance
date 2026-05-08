"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type Row = {
  id: string;
  documentType: string;
  entityId: string;
  status: string;
  currentStepNo: number;
  totalSteps: number;
  createdAt: string;
};

export default function ApprovalsInboxPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const search = useSearchParams();
  const highlightRequest = search.get("request");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/approvals/inbox");
    if (!res.ok) {
      setErr(await res.text());
      setRows([]);
    } else {
      setRows((await res.json()) as Row[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  async function approve(r: Row) {
    if (!token) return;
    setBusy(r.id);
    const res = await apiFetch(
      `/api/approvals/requests/${encodeURIComponent(r.id)}/steps/${encodeURIComponent(String(r.currentStepNo))}/approve`,
      { method: "POST" },
    );
    setBusy(null);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("common.save"));
    await load();
  }

  async function reject(r: Row) {
    if (!token) return;
    const c = rejectComment.trim();
    if (!c) {
      toast.error(t("approvals.rejectCommentLabel"));
      return;
    }
    setBusy(r.id);
    const res = await apiFetch(
      `/api/approvals/requests/${encodeURIComponent(r.id)}/steps/${encodeURIComponent(String(r.currentStepNo))}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: c }),
      },
    );
    setBusy(null);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    setRejectFor(null);
    setRejectComment("");
    toast.success(t("common.save"));
    await load();
  }

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t("approvals.inboxTitle")} subtitle={t("nav.approvalsInbox")} />
      {err ? <p className="text-sm text-red-600">{t("approvals.loadErr")}: {err}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-[#7F8C8D]">{t("approvals.empty")}</p>
      ) : null}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className={[
              "rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm",
              highlightRequest === r.id ? "ring-2 ring-primary/40" : "",
            ].join(" ")}
          >
            <div className="text-xs text-[#7F8C8D]">
              {r.documentType} · {r.entityId.slice(0, 8)}…
            </div>
            <div className="mt-1 text-sm font-medium text-[#34495E]">
              {t("approvals.step")}: {r.currentStepNo}/{r.totalSteps}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy === r.id}
                onClick={() => void approve(r)}
              >
                {t("approvals.approve")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy === r.id}
                onClick={() => {
                  setRejectFor(r.id);
                  setRejectComment("");
                }}
              >
                {t("approvals.reject")}
              </button>
            </div>
            {rejectFor === r.id ? (
              <div className="mt-3 space-y-2">
                <label className="block text-xs text-[#7F8C8D]">{t("approvals.rejectCommentLabel")}</label>
                <textarea
                  className="w-full rounded border border-[#D1D5DB] p-2 text-sm"
                  rows={3}
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy === r.id}
                    onClick={() => void reject(r)}
                  >
                    {t("approvals.reject")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => setRejectFor(null)}
                  >
                    {t("activityStream.cancel")}
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
