"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
} from "../../../lib/design-system";
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../../lib/form-styles";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";
import {
  ListPaginationFooter,
  DEFAULT_LIST_PAGE_SIZE,
} from "../../../components/list-pagination-footer";
import { parsePaginatedList } from "../../../lib/paginated-list";

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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [integrity, setIntegrity] = useState<{
    total: number;
    legacyWithoutHash: number;
    invalidCount: number;
    invalidIds: string[];
  } | null>(null);

  const initialLoaded = useRef(false);

  const runFetch = useCallback(
    async (requestPage: number, requestPageSize: number) => {
      if (!token) return;
      setLoadErr(null);
      setBusy(true);
      try {
        const q = new URLSearchParams();
        q.set("page", String(requestPage));
        q.set("pageSize", String(requestPageSize));
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
        const parsed = parsePaginatedList<AuditRow>(await res.json());
        setRows(parsed.items);
        setTotal(parsed.total);
        setPage(parsed.page);
        setPageSize(parsed.pageSize);
      } finally {
        setBusy(false);
      }
    },
    [token, userId, from, to, entityType, action],
  );

  useEffect(() => {
    if (!ready || !token || initialLoaded.current) return;
    initialLoaded.current = true;
    void runFetch(1, pageSize);
  }, [ready, token, runFetch, pageSize]);

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

  function onApplyFilters() {
    void runFetch(1, pageSize);
  }

  if (!ready || !token) {
    return <div className="text-sm text-gray-500">{t("common.loading")}</div>;
  }

  const filterToolbar = (
    <div className="flex max-w-6xl flex-wrap items-end gap-2">
      <label className="text-[12px] text-[#34495E]">
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
          {t("auditPage.filterUser")}
        </span>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="UUID"
          className={`h-8 w-44 ${TOOLBAR_MONTH_INPUT_CLASS} px-2`}
        />
      </label>
      <label className="text-[12px] text-[#34495E]">
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
          {t("auditPage.filterFrom")}
        </span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={`h-8 ${TOOLBAR_MONTH_INPUT_CLASS}`}
        />
      </label>
      <label className="text-[12px] text-[#34495E]">
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
          {t("auditPage.filterTo")}
        </span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={`h-8 ${TOOLBAR_MONTH_INPUT_CLASS}`}
        />
      </label>
      <label className="text-[12px] text-[#34495E]">
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
          {t("auditPage.filterEntity")}
        </span>
        <input
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder="Invoice"
          className={`h-8 w-32 ${TOOLBAR_MONTH_INPUT_CLASS} px-2`}
        />
      </label>
      <label className="text-[12px] text-[#34495E]">
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
          {t("auditPage.filterAction")}
        </span>
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="PATCH"
          className={`h-8 w-24 ${TOOLBAR_MONTH_INPUT_CLASS} px-2`}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => onApplyFilters()}
        className={`${PRIMARY_BUTTON_CLASS} h-8 px-3 text-[13px] disabled:opacity-50`}
      >
        {t("auditPage.apply")}
      </button>
    </div>
  );

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        title={t("auditPage.title")}
        subtitle={t("auditPage.subtitle")}
        actions={filterToolbar}
      />

      <section className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
        <h2 className="text-[13px] font-semibold text-[#34495E]">{t("auditPage.integrityCard")}</h2>
        <button type="button" onClick={() => void runIntegrity()} className={SECONDARY_BUTTON_CLASS}>
          {t("auditPage.integrity")}
        </button>
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

      <div className={`${DATA_TABLE_VIEWPORT_CLASS} ${CARD_CONTAINER_CLASS} overflow-hidden`}>
        <table className={`${DATA_TABLE_CLASS} min-w-full text-[13px]`}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditPage.colTime")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditPage.colUser")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditPage.colEntity")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditPage.colAction")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditPage.colHash")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditPage.colDiff")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap text-[#34495E]`}>
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className={`${DATA_TABLE_TD_CLASS} max-w-[180px] truncate`} title={r.user?.email ?? r.userId ?? ""}>
                  {r.user
                    ? [r.user.firstName, r.user.lastName].filter(Boolean).join(" ").trim() ||
                      r.user.fullName?.trim() ||
                      r.user.email
                    : (r.userId ?? "—")}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <span className="font-medium">{r.entityType}</span>
                  <span className="ml-1 break-all text-[12px] text-[#7F8C8D]">{r.entityId}</span>
                </td>
                <td className={DATA_TABLE_TD_CLASS}>{r.action}</td>
                <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[12px]`}>
                  {r.hash ? `${r.hash.slice(0, 12)}…` : "—"}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
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
        <div className="px-4 pb-4">
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            loading={busy}
            onPageChange={(p) => void runFetch(p, pageSize)}
            onPageSizeChange={(ps) => {
              setPageSize(ps);
              setPage(1);
              void runFetch(1, ps);
            }}
          />
        </div>
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
