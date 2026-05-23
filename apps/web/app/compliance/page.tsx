"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";
import { EmptyState } from "../../components/empty-state";
import {
  DEFAULT_LIST_PAGE_SIZE,
  ListPaginationFooter,
} from "../../components/list-pagination-footer";
import { PageHeader } from "../../components/layout/page-header";
import { useAuth } from "../../lib/auth-context";
import { useSubscription } from "../../lib/subscription-context";
import { useRequireAuth } from "../../lib/use-require-auth";
import { TaxLimitWidget } from "./components/tax-limit-widget";

type RiskAuditRow = {
  id: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  metadata: unknown;
  mitigationNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: RiskAuditRow[];
  total: number;
  page: number;
  pageSize: number;
};

type RiskSummary = {
  posture: "green" | "yellow" | "red";
  pending: { high: number; medium: number; low: number; total: number };
};

export default function ComplianceDashboardPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();
  const { user } = useAuth();
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();

  const tier = snapshot?.tier ? String(snapshot.tier).toUpperCase() : "";
  const moduleLocked =
    subReady &&
    snapshot &&
    tier !== "TIER_3" &&
    !snapshot.modules.compliancePro;

  const canPatch =
    user?.role === "OWNER" || user?.role === "ADMIN" || user?.isSuperAdmin;

  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [list, setList] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [councilBusyId, setCouncilBusyId] = useState<string | null>(null);
  const router = useRouter();

  const loadSummary = useCallback(async () => {
    if (!token || moduleLocked) return;
    const res = await apiFetch("/api/compliance/risk-summary");
    if (!res.ok) return;
    setSummary((await res.json()) as RiskSummary);
  }, [token, moduleLocked]);

  const loadList = useCallback(async () => {
    if (!token || moduleLocked) return;
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("pageSize", String(pageSize));
    if (statusFilter === "PENDING") q.set("status", "PENDING");
    const res = await apiFetch(`/api/compliance/risk-audits?${q.toString()}`);
    if (!res.ok) {
      setErr(t("compliance.loadErr"));
      setLoading(false);
      return;
    }
    setList((await res.json()) as ListResponse);
    setLoading(false);
  }, [token, moduleLocked, page, pageSize, statusFilter, t]);

  useEffect(() => {
    if (!ready || !token || moduleLocked) return;
    void loadSummary();
  }, [ready, token, moduleLocked, loadSummary]);

  useEffect(() => {
    if (!ready || !token || moduleLocked) return;
    void loadList();
  }, [ready, token, moduleLocked, loadList]);

  const refresh = useCallback(() => {
    void loadSummary();
    void loadList();
  }, [loadSummary, loadList]);

  const onAskCouncil = useCallback(
    async (riskAuditId: string) => {
      setCouncilBusyId(riskAuditId);
      setErr(null);
      const res = await apiFetch("/api/compliance/council/deliberate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskAuditId }),
      });
      setCouncilBusyId(null);
      if (!res.ok) {
        setErr(t("compliance.council.askCouncilErr"));
        return;
      }
      const data = (await res.json()) as { verdictId: string };
      router.push(`/compliance/council/${data.verdictId}`);
    },
    [router, t],
  );

  const onMitigate = useCallback(
    async (id: string, status: "MITIGATED" | "IGNORED") => {
      const note = (noteById[id] ?? "").trim();
      setActingId(id);
      setErr(null);
      const res = await apiFetch(`/api/compliance/risk-audits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          mitigationNote: note || undefined,
        }),
      });
      setActingId(null);
      if (!res.ok) {
        setErr(t("compliance.patchErr"));
        return;
      }
      setNoteById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      refresh();
    },
    [noteById, refresh, t],
  );

  const heatmap = useMemo(() => {
    const p = summary?.pending ?? { high: 0, medium: 0, low: 0, total: 0 };
    return p;
  }, [summary]);

  if (!ready || !token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("compliance.pageTitle")}
        subtitle={t("compliance.pageSubtitle")}
        actions={
          !moduleLocked ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => refresh()}
              disabled={loading}
            >
              {t("compliance.refresh")}
            </button>
          ) : null
        }
      />

      {moduleLocked ? (
        <EmptyState
          title={t("compliance.paywallTitle")}
          description={t("compliance.paywallBody")}
          action={
            <Link href="/settings/subscription" className={PRIMARY_BUTTON_CLASS}>
              {t("compliance.paywallCta")}
            </Link>
          }
        />
      ) : (
        <>
          <TaxLimitWidget />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`${CARD_CONTAINER_CLASS} p-4`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
                {t("compliance.summaryPosture")}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={[
                    "inline-block h-3 w-3 rounded-full",
                    summary?.posture === "red"
                      ? "bg-red-500"
                      : summary?.posture === "yellow"
                        ? "bg-amber-400"
                        : "bg-emerald-500",
                  ].join(" ")}
                  aria-hidden
                />
                <span className="text-lg font-semibold text-[#34495E]">
                  {summary
                    ? t(`compliance.posture.${summary.posture}`)
                    : "—"}
                </span>
              </div>
            </div>
            <div className={`${CARD_CONTAINER_CLASS} p-4`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
                {t("compliance.summaryPendingHigh")}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-[#34495E]">
                {heatmap.high}
              </div>
            </div>
            <div className={`${CARD_CONTAINER_CLASS} p-4`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
                {t("compliance.summaryPendingMedium")}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-[#34495E]">
                {heatmap.medium}
              </div>
            </div>
            <div className={`${CARD_CONTAINER_CLASS} p-4`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#95A5A6]">
                {t("compliance.summaryPendingLow")}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-[#34495E]">
                {heatmap.low}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-[#7F8C8D]">{t("compliance.filterLabel")}</span>
            <select
              className="rounded-lg border border-[#D5DADF] bg-white px-3 py-1.5 text-[13px] text-[#34495E] shadow-sm focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "PENDING" | "ALL");
                setPage(1);
              }}
            >
              <option value="PENDING">{t("compliance.filterPending")}</option>
              <option value="ALL">{t("compliance.filterAll")}</option>
            </select>
          </div>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}

          <div className="space-y-3">
            {loading && !list ? (
              <p className="text-[13px] text-[#7F8C8D]">{t("compliance.loading")}</p>
            ) : null}
            {(list?.items ?? []).length === 0 && !loading ? (
              <EmptyState
                compact
                title={t("compliance.emptyAlerts")}
                className="bg-white"
              />
            ) : null}
            {(list?.items ?? []).map((row) => (
              <div
                key={row.id}
                className={`${CARD_CONTAINER_CLASS} rounded-lg p-4 sm:p-5`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#95A5A6]">
                      <span>{t(`compliance.type.${row.type}`, { defaultValue: row.type })}</span>
                      <span>·</span>
                      <span>{t(`compliance.severity.${row.severity}`)}</span>
                      <span>·</span>
                      <span>{t(`compliance.status.${row.status}`)}</span>
                    </div>
                    <p className="text-[13px] font-medium text-[#34495E]">{row.description}</p>
                    <p className="font-mono text-[12px] text-[#7F8C8D] tabular-nums">
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {row.status === "PENDING" ? (
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={councilBusyId === row.id}
                        onClick={() => void onAskCouncil(row.id)}
                      >
                        {councilBusyId === row.id
                          ? t("compliance.council.askCouncilBusy")
                          : t("compliance.council.askCouncil")}
                      </button>
                    </div>
                  ) : null}
                  {row.status === "PENDING" && canPatch ? (
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-64">
                      <label className="block text-[12px] font-semibold text-[#34495E]">
                        {t("compliance.mitigationNoteLabel")}
                        <textarea
                          className="mt-1 w-full min-h-[3.5rem] resize-y rounded-lg border border-[#D5DADF] bg-white px-3 py-2 text-[13px] text-[#34495E] shadow-sm focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
                          rows={2}
                          value={noteById[row.id] ?? ""}
                          onChange={(e) =>
                            setNoteById((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                          placeholder={t("compliance.mitigationNotePh")}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={PRIMARY_BUTTON_CLASS}
                          disabled={actingId === row.id}
                          onClick={() => void onMitigate(row.id, "MITIGATED")}
                        >
                          {t("compliance.actionMitigate")}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={actingId === row.id}
                          onClick={() => void onMitigate(row.id, "IGNORED")}
                        >
                          {t("compliance.actionIgnore")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {row.status !== "PENDING" && row.mitigationNote ? (
                    <p className="max-w-md text-[12px] text-[#5D6D7E]">
                      <span className="font-semibold text-[#34495E]">
                        {t("compliance.notePrefix")}
                      </span>{" "}
                      {row.mitigationNote}
                    </p>
                  ) : null}
                  {!canPatch && row.status === "PENDING" ? (
                    <p className="text-[12px] text-[#7F8C8D]">{t("compliance.viewOnlyHint")}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {list && list.total > 0 ? (
            <ListPaginationFooter
              page={list.page}
              pageSize={list.pageSize}
              total={list.total}
              onPageChange={(p) => {
                setPage(p);
              }}
              onPageSizeChange={(ps) => {
                setPageSize(ps);
                setPage(1);
              }}
              loading={loading}
            />
          ) : null}

          <p className="text-[12px] leading-snug text-[#95A5A6]">{t("compliance.disclaimer")}</p>
        </>
      )}
    </div>
  );
}

