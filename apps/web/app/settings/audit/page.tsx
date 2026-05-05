"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";

type AuditRow = {
  id: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  oldValues: unknown;
  newValues: unknown;
  changes: unknown;
  hash: string | null;
  clientIp: string | null;
  userAgent: string | null;
  user?: {
    id: string;
    email: string;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export default function AuditSettingsPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [integrity, setIntegrity] = useState<{
    total: number;
    legacyWithoutHash: number;
    invalidCount: number;
    invalidIds: string[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadErr(null);
    setBusy(true);
    try {
      const q = new URLSearchParams();
      q.set("take", "100");
      if (userId.trim()) q.set("userId", userId.trim());
      if (from.trim()) q.set("from", new Date(from).toISOString());
      if (to.trim()) q.set("to", new Date(to).toISOString());
      if (entityType.trim()) q.set("entityType", entityType.trim());
      if (action.trim()) q.set("action", action.trim());
      const res = await apiFetch(`/api/audit/logs?${q.toString()}`);
      if (!res.ok) {
        setLoadErr(String(res.status));
        return;
      }
      const body = (await res.json()) as { items: AuditRow[] };
      setRows(body.items ?? []);
    } finally {
      setBusy(false);
    }
  }, [token, userId, from, to, entityType, action]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
    // initial load only; filters apply via button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  async function runIntegrity() {
    setIntegrity(null);
    const res = await apiFetch("/api/audit/integrity-check", { method: "POST" });
    if (!res.ok) {
      setLoadErr(String(res.status));
      return;
    }
    setIntegrity(
      (await res.json()) as {
        total: number;
        legacyWithoutHash: number;
        invalidCount: number;
        invalidIds: string[];
      },
    );
  }

  if (!ready || !token) {
    return <div className="text-sm text-gray-500">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader title={t("auditPage.title")} subtitle={t("auditPage.subtitle")} />

      <section className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
        <h2 className="text-[13px] font-semibold text-[#34495E]">{t("auditPage.filters")}</h2>
        <div className="flex flex-wrap gap-3 items-end text-[13px]">
          <label className="text-[#34495E]">
            {t("auditPage.filterUser")}
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID"
              className={`block mt-1 w-64 ${INPUT_BORDERED_CLASS}`}
            />
          </label>
          <label className="text-[#34495E]">
            {t("auditPage.filterFrom")}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`block mt-1 ${INPUT_BORDERED_CLASS}`}
            />
          </label>
          <label className="text-[#34495E]">
            {t("auditPage.filterTo")}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`block mt-1 ${INPUT_BORDERED_CLASS}`}
            />
          </label>
          <label className="text-[#34495E]">
            {t("auditPage.filterEntity")}
            <input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="Invoice, Product…"
              className={`block mt-1 w-40 ${INPUT_BORDERED_CLASS}`}
            />
          </label>
          <label className="text-[#34495E]">
            {t("auditPage.filterAction")}
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="POST, PATCH…"
              className={`block mt-1 w-28 ${INPUT_BORDERED_CLASS}`}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-50`}
          >
            {t("auditPage.apply")}
          </button>
          <button
            type="button"
            onClick={() => void runIntegrity()}
            className={SECONDARY_BUTTON_CLASS}
          >
            {t("auditPage.integrity")}
          </button>
        </div>
        {integrity && (
          <p className="text-sm text-gray-700">
            {t("auditPage.integrityResult", {
              total: integrity.total,
              legacy: integrity.legacyWithoutHash,
              invalid: integrity.invalidCount,
            })}
          </p>
        )}
      </section>

      {loadErr && <p className="text-red-600 text-sm">{loadErr}</p>}

      <div className={`overflow-x-auto ${CARD_CONTAINER_CLASS}`}>
        <table className="min-w-full text-[13px]">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2 font-medium">{t("auditPage.colTime")}</th>
              <th className="px-3 py-2 font-medium">{t("auditPage.colUser")}</th>
              <th className="px-3 py-2 font-medium">{t("auditPage.colEntity")}</th>
              <th className="px-3 py-2 font-medium">{t("auditPage.colAction")}</th>
              <th className="px-3 py-2 font-medium">{t("auditPage.colHash")}</th>
              <th className="px-3 py-2 font-medium">{t("auditPage.colDiff")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td
                  className="px-3 py-2 max-w-[180px] truncate"
                  title={r.user?.email ?? r.userId ?? ""}
                >
                  {r.user
                    ? [r.user.firstName, r.user.lastName].filter(Boolean).join(" ").trim() ||
                      r.user.fullName?.trim() ||
                      r.user.email
                    : (r.userId ?? "—")}
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium">{r.entityType}</span>
                  <span className="text-gray-500 text-xs ml-1 break-all">{r.entityId}</span>
                </td>
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.hash ? `${r.hash.slice(0, 12)}…` : "—"}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="font-medium text-[#2980B9] hover:text-[#34495E] hover:underline"
                  >
                    {t("auditPage.viewDiff")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal
        >
          <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-5xl`}>
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
                {t("auditPage.diffTitle")}
              </h3>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setSelected(null)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </header>
            <div className="mt-4 grid min-h-0 max-h-[60vh] flex-1 gap-4 overflow-y-auto text-[13px] md:grid-cols-2">
              <div className="flex min-h-0 flex-col gap-1.5">
                <div className={MODAL_FIELD_LABEL_CLASS}>{t("auditPage.before")}</div>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#D5DADF] bg-[#F4F5F7] p-3 font-mono text-[12px] text-[#34495E]">
                  {formatJson(selected.oldValues)}
                </pre>
              </div>
              <div className="flex min-h-0 flex-col gap-1.5">
                <div className={MODAL_FIELD_LABEL_CLASS}>{t("auditPage.after")}</div>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#D5DADF] bg-[#F4F5F7] p-3 font-mono text-[12px] text-[#34495E]">
                  {formatJson(selected.newValues)}
                </pre>
              </div>
            </div>
            <p className="m-0 mt-4 text-[13px] text-[#7F8C8D]">
              IP: {selected.clientIp ?? "—"} · {selected.userAgent ?? "—"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatJson(v: unknown): string {
  if (v === null || v === undefined) {
    return "—";
  }
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
