"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuditDetailConfirmModal } from "../../../../components/inventory/modals";
import { PageHeader } from "../../../../components/layout/page-header";
import { apiFetch } from "../../../../lib/api-client";
import { notifyListRefresh } from "../../../../lib/list-refresh-bus";
import { useAuth } from "../../../../lib/auth-context";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";
import { isRestrictedUserRole } from "../../../../lib/role-utils";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { ActivityPanel } from "../../../../components/activity/ActivityPanel";

type AuditLineDetail = {
  id: string;
  productId: string;
  systemQty: unknown;
  factQty: unknown;
  costPrice: unknown;
  product?: { id: string; name: string; sku: string; isService?: boolean } | null;
};

type AuditDetail = {
  id: string;
  date: string;
  status: string;
  warehouseId: string;
  warehouse?: { id: string; name: string; inventoryAccountCode?: string } | null;
  createdAt: string;
  lines?: AuditLineDetail[];
};

function numStr(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "object" && v !== null && "toString" in v) {
    return String((v as { toString(): string }).toString());
  }
  return String(v);
}

function toNum(v: string): number {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function InventoryAuditDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const mayPost = !isRestrictedUserRole(user?.role ?? undefined);

  const [row, setRow] = useState<AuditDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const pendingTimers = useRef<Record<string, number>>({});
  const rowRef = useRef<AuditDetail | null>(null);
  useEffect(() => {
    rowRef.current = row;
  }, [row]);

  const load = useCallback(async () => {
    if (!token || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch(`/api/inventory/audits/${encodeURIComponent(id)}`);
    if (!res.ok) {
      setError(await res.text());
      setRow(null);
    } else {
      setRow((await res.json()) as AuditDetail);
    }
    setLoading(false);
  }, [token, id]);

  useEffect(() => {
    if (!ready || !token || !id) return;
    void load();
  }, [load, ready, token, id]);

  useEffect(() => {
    return () => {
      Object.values(pendingTimers.current).forEach((tid) => window.clearTimeout(tid));
    };
  }, []);

  const lines = row?.lines ?? [];
  const isCounting = row?.status === "COUNTING";
  const isReview = row?.status === "REVIEW";

  function statusLabel(s: string): string {
    switch (s) {
      case "DRAFT":
        return t("inventory.auditStatusDraft");
      case "COUNTING":
        return t("inventory.auditStatusCounting");
      case "REVIEW":
        return t("inventory.auditStatusReview");
      case "COMPLETED":
        return t("inventory.auditStatusCompleted");
      case "CANCELLED":
        return t("inventory.auditStatusCancelled");
      case "APPROVED":
        return t("inventory.auditStatusApproved");
      default:
        return s;
    }
  }

  const totals = useMemo(() => {
    let sumAbs = 0;
    for (const l of lines) {
      const system = toNum(numStr(l.systemQty));
      const fact = toNum(numStr(l.factQty));
      const diff = fact - system;
      const cost = toNum(numStr(l.costPrice));
      sumAbs += Math.abs(diff * cost);
    }
    return { sumAbs };
  }, [lines]);

  function patchLineDebounced(lineId: string, next: { factQty?: string; costPrice?: string }) {
    if (!token) return;
    const ms = 400;
    const existing = pendingTimers.current[lineId];
    if (existing) window.clearTimeout(existing);
    pendingTimers.current[lineId] = window.setTimeout(() => {
      setSavingLineId(lineId);
      void (async () => {
        const r = rowRef.current;
        if (!r?.id || r.status !== "COUNTING") return;
        const res = await apiFetch(
          `/api/inventory/reconciliations/${encodeURIComponent(r.id)}/lines/${encodeURIComponent(lineId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(next.factQty != null ? { factQty: toNum(next.factQty) } : {}),
              ...(next.costPrice != null ? { costPrice: toNum(next.costPrice) } : {}),
            }),
          },
        );
        if (!res.ok) throw new Error(await res.text());
      })()
        .catch((e) => {
          toast.error(t("common.saveErr"), { description: String(e) });
        })
        .finally(() => setSavingLineId((cur) => (cur === lineId ? null : cur)));
    }, ms);
  }

  async function handleSubmitForReview() {
    if (!token || !id) return;
    setSubmitBusy(true);
    const res = await apiFetch(`/api/inventory/reconciliations/${encodeURIComponent(id)}/submit`, {
      method: "POST",
    });
    setSubmitBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    await load();
    toast.success(t("common.save"));
    setSubmitOpen(false);
  }

  async function handleComplete() {
    if (!token || !id || !row?.lines) return;
    setCompleteBusy(true);
    const eps = 1e-4;
    try {
      for (const line of row.lines) {
        const d = toNum(numStr(line.factQty)) - toNum(numStr(line.systemQty));
        if (Math.abs(d) < eps) continue;
        const discrepancyKind = d > 0 ? "SURPLUS" : "SHORTAGE_WRITEOFF";
        const cr = await apiFetch(
          `/api/inventory/reconciliations/${encodeURIComponent(id)}/lines/${encodeURIComponent(line.id)}/classification`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ discrepancyKind }),
          },
        );
        if (!cr.ok) throw new Error(await cr.text());
      }
      const res = await apiFetch(`/api/inventory/reconciliations/${encodeURIComponent(id)}/complete`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      toast.success(t("inventory.auditOkCompleted"));
      notifyListRefresh("inventory-audits");
      setCompleteOpen(false);
    } catch (e) {
      toast.error(t("common.saveErr"), { description: String(e) });
    } finally {
      setCompleteBusy(false);
    }
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
    <div className="max-w-6xl space-y-8 lg:flex lg:items-start lg:gap-8">
      <div className="min-w-0 flex-1 space-y-8">
      <PageHeader
        title={t("inventory.auditDetailTitle")}
        subtitle={
          row ? (
            <span>
              {typeof row.date === "string" ? row.date.slice(0, 10) : "—"} ·{" "}
              {row.warehouse?.name ? `${row.warehouse.name} · ` : null}
              {statusLabel(row.status)}
            </span>
          ) : undefined
        }
        actions={
          <>
            {mayPost && isCounting && (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setSubmitOpen(true)}>
                {t("inventory.auditSubmitReview")}
              </button>
            )}
            {mayPost && isReview && (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCompleteOpen(true)}>
                {t("inventory.auditPostComplete")}
              </button>
            )}
            <Link href="/inventory/audits" className={SECONDARY_BUTTON_CLASS}>
              {t("inventory.auditHistoryBack")}
            </Link>
          </>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>}

      {!loading && row && lines.length > 0 && (
        <>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.auditThProduct")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thSku")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.auditThSystem")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.auditThFact")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.auditThDiff")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.auditThCost")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.auditThAmountDiff")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const system = toNum(numStr(l.systemQty));
                  const fact = toNum(numStr(l.factQty));
                  const diff = fact - system;
                  const cost = toNum(numStr(l.costPrice));
                  const amt = diff * cost;
                  return (
                    <tr key={l.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>
                        {l.product?.name ?? l.productId}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs text-[#7F8C8D]`}>
                        {l.product?.sku ?? "—"}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{numStr(l.systemQty)}</td>
                      <td className={`${DATA_TABLE_TD_RIGHT_CLASS} max-w-[9rem]`}>
                        {isCounting ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className={`${MODAL_INPUT_NUMERIC_CLASS} w-full max-w-[8rem] ml-auto`}
                            value={numStr(l.factQty)}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRow((cur) =>
                                !cur
                                  ? cur
                                  : {
                                      ...cur,
                                      lines: (cur.lines ?? []).map((x) =>
                                        x.id === l.id ? { ...x, factQty: v } : x,
                                      ),
                                    },
                              );
                              patchLineDebounced(l.id, { factQty: v });
                            }}
                          />
                        ) : (
                          <span className="tabular-nums">{numStr(l.factQty)}</span>
                        )}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{diff.toFixed(4)}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{numStr(l.costPrice)}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {amt.toFixed(2)}
                        {savingLineId === l.id ? (
                          <span className="ml-1 text-xs text-[#7F8C8D]">…</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-600">
            {t("inventory.auditTotalDiff")}:{" "}
            <span className="font-semibold tabular-nums">{totals.sumAbs.toFixed(2)}</span>
          </p>
          {(isCounting || isReview) && (
            <p className="text-xs text-slate-500">{t("inventory.auditApproveHint")}</p>
          )}
        </>
      )}

      {!loading && row && lines.length === 0 && (
        <p className="text-sm text-slate-600">{t("inventory.auditDetailNoLines")}</p>
      )}
      </div>

      {id ? (
        <div className="shrink-0 lg:w-[min(100%,320px)] lg:sticky lg:top-4">
          <ActivityPanel entityType="inventory_audit" entityId={id} canComment={mayPost} />
        </div>
      ) : null}

      <AuditDetailConfirmModal
        open={submitOpen}
        title={t("inventory.auditSubmitReview")}
        onClose={() => setSubmitOpen(false)}
        busy={submitBusy}
        onConfirm={() => void handleSubmitForReview()}
      >
        <p className="m-0">{t("inventory.auditConfirmSubmitReviewBody")}</p>
      </AuditDetailConfirmModal>

      <AuditDetailConfirmModal
        open={completeOpen}
        title={t("inventory.auditPostComplete")}
        onClose={() => setCompleteOpen(false)}
        busy={completeBusy}
        onConfirm={() => void handleComplete()}
      >
        <p className="m-0">{t("inventory.auditConfirmCompleteBody")}</p>
      </AuditDetailConfirmModal>
    </div>
  );
}
