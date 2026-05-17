"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";
import { EmptyState } from "../empty-state";
import {
  CARD_CONTAINER_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
} from "../../lib/design-system";
import { EmptySelectOption } from "../../lib/empty-select-option";
import { Button } from "../ui/button";
import Link from "next/link";
import { LINK_ACCENT_CLASS } from "../../lib/design-system";

type WarehouseRow = { id: string; name: string; inventoryAccountCode?: string };

type AuditLine = {
  id: string;
  productId: string;
  systemQty: unknown;
  factQty: unknown;
  costPrice: unknown;
  product: { id: string; name: string; sku: string };
};

type AuditDetail = {
  id: string;
  date: string;
  status: "DRAFT" | "COUNTING" | "REVIEW" | "COMPLETED" | "CANCELLED";
  warehouseId: string;
  warehouse: { id: string; name: string; inventoryAccountCode: string };
  lines: AuditLine[];
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

/**
 * Многошаговый сценарий инвентаризации (черновик → строки → утверждение).
 * Используется в модальном окне на `/inventory/audits` (ранее отдельная страница `/inventory/audit/new`).
 */
export function InventoryAuditCreateFlow({
  onNavigateToHistory,
  onBackToInventory,
  onAuditStarted,
  compactForModal = false,
}: {
  onNavigateToHistory: () => void;
  onBackToInventory: () => void;
  /** After COUNTING starts, parent may navigate to `/inventory/audits/:id`. */
  onAuditStarted?: (auditId: string) => void;
  /** Hide duplicate title/back when embedded in create dialog on `/inventory/audits`. */
  compactForModal?: boolean;
}) {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const pendingTimers = useRef<Record<string, number>>({});
  const auditRef = useRef<AuditDetail | null>(null);
  useEffect(() => {
    auditRef.current = audit;
  }, [audit]);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch("/api/inventory/warehouses");
    if (!res.ok) {
      setError(`${t("inventory.loadErr")}: ${res.status}`);
      setWarehouses([]);
    } else {
      const data = (await res.json()) as WarehouseRow[];
      setWarehouses(data);
      if (data[0] && !warehouseId) setWarehouseId(data[0].id);
    }
    setLoading(false);
  }, [token, t, warehouseId]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  const dateStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  async function createDraft() {
    if (!token || creating) return;
    if (!warehouseId) {
      toast.error(t("inventory.auditSelectWarehouse"));
      return;
    }
    setCreating(true);
    setError(null);
    const res = await apiFetch("/api/inventory/reconciliations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateStr,
        warehouseId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    });
    if (!res.ok) {
      setCreating(false);
      setError(await res.text());
      return;
    }
    const created = (await res.json()) as AuditDetail;
    const startRes = await apiFetch(
      `/api/inventory/reconciliations/${encodeURIComponent(created.id)}/start`,
      { method: "POST" },
    );
    setCreating(false);
    if (!startRes.ok) {
      setError(await startRes.text());
      setAudit(created);
      return;
    }
    const detail = await apiFetch(
      `/api/inventory/reconciliations/${encodeURIComponent(created.id)}`,
    );
    if (detail.ok) {
      const next = (await detail.json()) as AuditDetail;
      setAudit(next);
      toast.success(t("inventory.auditOkDraft"));
      onAuditStarted?.(next.id);
    } else {
      setError(await detail.text());
    }
  }

  async function submitForReview() {
    if (!token || workflowBusy || !audit?.id) return;
    if (audit.status !== "COUNTING") {
      toast.error(t("inventory.auditApproveNotDraft"));
      return;
    }
    setWorkflowBusy(true);
    setError(null);
    const res = await apiFetch(
      `/api/inventory/reconciliations/${encodeURIComponent(audit.id)}/submit`,
      { method: "POST" },
    );
    setWorkflowBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const updated = await apiFetch(`/api/inventory/reconciliations/${encodeURIComponent(audit.id)}`);
    if (updated.ok) setAudit((await updated.json()) as AuditDetail);
  }

  async function postComplete() {
    if (!token || workflowBusy || !audit?.id) return;
    if (audit.status !== "REVIEW") {
      toast.error(t("inventory.auditApproveNotDraft"));
      return;
    }
    setWorkflowBusy(true);
    setError(null);
    const eps = 1e-4;
    try {
      for (const line of audit.lines) {
        const d = toNum(numStr(line.factQty)) - toNum(numStr(line.systemQty));
        if (Math.abs(d) < eps) continue;
        const discrepancyKind = d > 0 ? "SURPLUS" : "SHORTAGE_WRITEOFF";
        const cr = await apiFetch(
          `/api/inventory/reconciliations/${encodeURIComponent(audit.id)}/lines/${encodeURIComponent(line.id)}/classification`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ discrepancyKind }),
          },
        );
        if (!cr.ok) throw new Error(await cr.text());
      }
      const res = await apiFetch(
        `/api/inventory/reconciliations/${encodeURIComponent(audit.id)}/complete`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("inventory.auditOkCompleted"));
      const updated = await apiFetch(`/api/inventory/reconciliations/${encodeURIComponent(audit.id)}`);
      if (updated.ok) setAudit((await updated.json()) as AuditDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorkflowBusy(false);
    }
  }

  function patchLineDebounced(lineId: string, next: { factQty?: string; costPrice?: string }) {
    if (!token) return;
    const ms = 400;
    const existing = pendingTimers.current[lineId];
    if (existing) window.clearTimeout(existing);
    pendingTimers.current[lineId] = window.setTimeout(() => {
      setSavingLineId(lineId);
      void (async () => {
        const a = auditRef.current;
        if (!a?.id) return;
        const res = await apiFetch(
          `/api/inventory/reconciliations/${encodeURIComponent(a.id)}/lines/${encodeURIComponent(lineId)}`,
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
        .then(async () => {
          /* ok */
        })
        .catch(async () => {
          /* ignore */
        })
        .finally(() => setSavingLineId((cur) => (cur === lineId ? null : cur)));
    }, ms);
  }

  const totals = useMemo(() => {
    if (!audit?.lines?.length) return { sumAbs: 0 };
    const sumAbs = audit.lines.reduce((acc, l) => {
      const d = toNum(numStr(l.factQty)) - toNum(numStr(l.systemQty));
      const amt = d * toNum(numStr(l.costPrice));
      return acc + Math.abs(amt);
    }, 0);
    return { sumAbs };
  }, [audit]);

  if (!ready) {
    return (
      <div className="text-[13px] text-[#7F8C8D]">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-4">
      {!compactForModal ? (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="m-0 text-lg font-semibold text-[#34495E]">{t("inventory.auditTitle")}</h2>
          <p className="mb-0 mt-1 text-[13px] leading-snug text-[#7F8C8D]">{t("inventory.auditSubtitle")}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="!h-auto text-[13px] font-medium text-[#2980B9] hover:bg-transparent"
          onClick={onBackToInventory}
        >
          {t("inventory.auditBack")}
        </Button>
      </div>
      ) : null}

      {error && <p className="text-[13px] text-red-600">{error}</p>}
      {loading && <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>}

      {!loading && warehouses.length === 0 && !error && (
        <EmptyState
          title={t("inventory.auditEmpty")}
          description={t("inventory.emptyStockHint")}
          action={
            compactForModal ? (
              <Link href="/inventory/settings" className={LINK_ACCENT_CLASS}>
                {t("inventory.settings")}
              </Link>
            ) : undefined
          }
        />
      )}

      {!loading && warehouses.length > 0 && !audit && (
        <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
          <p className="m-0 text-[13px] leading-relaxed text-[#7F8C8D]">{t("inventory.auditCreateSteps")}</p>
          {compactForModal ? (
            <p className="m-0 text-[12px] text-[#7F8C8D]">{t("inventory.auditCreateModalHint")}</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("inventory.thWh")}
              <select
                className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <EmptySelectOption />
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("inventory.auditThDateDoc")}
              <input type="date" className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`} value={dateStr} readOnly />
            </label>
          </div>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("inventory.auditNotesOptional")}
            <textarea
              className={`mt-1 block min-h-[4rem] w-full resize-y ${MODAL_INPUT_CLASS}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder={t("inventory.auditNotesPlaceholder")}
            />
          </label>
          <div className={MODAL_FOOTER_ACTIONS_CLASS}>
            <Button
              type="button"
              variant="primary"
              className={MODAL_FOOTER_BUTTON_CLASS}
              disabled={creating}
              onClick={() => void createDraft()}
            >
              {creating
                ? "…"
                : t(compactForModal ? "inventory.auditCreateAndStart" : "inventory.auditSaveDraft")}
            </Button>
          </div>
          {compactForModal ? (
            <p className="m-0 text-[12px] text-[#7F8C8D]">{t("inventory.auditStartAndOpen")}</p>
          ) : null}
        </div>
      )}

      {audit && !compactForModal && (
        <>
          <section className="overflow-x-auto rounded-2xl border border-[#D5DADF] bg-white shadow-sm">
            <table className="min-w-full border-collapse text-[13px]">
              <thead>
                <tr className="sticky top-0 z-[1] border-b border-[#D5DADF] bg-[#F8FAFC]">
                  <th className="px-4 py-2 text-left text-xs font-bold text-[#475569]">{t("inventory.thProduct")}</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-[#475569]">{t("inventory.thSku")}</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-[#475569]">
                    {t("inventory.auditThSystem")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-[#475569]">
                    {t("inventory.auditThFact")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-[#475569]">
                    {t("inventory.auditThDiff")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-[#475569]">
                    {t("inventory.auditThCost")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-[#475569]">
                    {t("inventory.auditThAmountDiff")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {audit.lines.map((l) => {
                  const system = toNum(numStr(l.systemQty));
                  const fact = toNum(numStr(l.factQty));
                  const diff = fact - system;
                  const cost = toNum(numStr(l.costPrice));
                  const amt = diff * cost;
                  const disabled = audit.status !== "COUNTING";
                  return (
                    <tr key={l.id} className="border-b border-[#D5DADF] bg-white transition-colors hover:bg-[#F1F5F9]">
                      <td className="px-4 py-2 align-middle text-[#34495E]">{l.product?.name ?? l.productId}</td>
                      <td className="px-4 py-2 align-middle font-mono text-[13px] text-[#7F8C8D]">
                        {l.product?.sku ?? t("common.emptyValue")}
                      </td>
                      <td className="px-4 py-2 align-middle text-right font-mono tabular-nums text-[#7F8C8D]">
                        {numStr(l.systemQty)}
                      </td>
                      <td className="px-4 py-2 align-middle text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className={`${MODAL_INPUT_NUMERIC_CLASS} !w-28 max-w-[7rem]`}
                          value={numStr(l.factQty)}
                          disabled={disabled}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAudit((cur) =>
                              !cur
                                ? cur
                                : {
                                    ...cur,
                                    lines: cur.lines.map((x) => (x.id === l.id ? { ...x, factQty: v } : x)),
                                  },
                            );
                            patchLineDebounced(l.id, { factQty: v });
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 align-middle text-right font-mono tabular-nums text-[#34495E]">
                        {diff.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 align-middle text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className={`${MODAL_INPUT_NUMERIC_CLASS} !w-28 max-w-[7rem]`}
                          value={numStr(l.costPrice)}
                          disabled={disabled}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAudit((cur) =>
                              !cur
                                ? cur
                                : {
                                    ...cur,
                                    lines: cur.lines.map((x) => (x.id === l.id ? { ...x, costPrice: v } : x)),
                                  },
                            );
                            patchLineDebounced(l.id, { costPrice: v });
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 align-middle text-right font-mono tabular-nums text-[#34495E]">
                        {amt.toFixed(2)}
                        {savingLineId === l.id ? (
                          <span className="ml-2 text-xs text-[#7F8C8D]">…</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <div className="space-y-4">
            <p className="m-0 text-[13px] text-[#7F8C8D]">
              {t("inventory.auditTotalDiff")}:{" "}
              <span className="font-semibold tabular-nums text-[#34495E]">{totals.sumAbs.toFixed(2)}</span>
            </p>
            <p className="m-0 max-w-2xl text-[13px] text-[#7F8C8D]">{t("inventory.auditApproveHint")}</p>
          </div>
          <div className={MODAL_FOOTER_ACTIONS_CLASS}>
            <Button
              type="button"
              variant="outline"
              className={MODAL_FOOTER_BUTTON_CLASS}
              onClick={onNavigateToHistory}
            >
              {t("inventory.auditHistoryBack")}
            </Button>
            {audit.status === "COUNTING" ? (
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={workflowBusy}
                onClick={() => void submitForReview()}
              >
                {workflowBusy ? "…" : t("inventory.auditSubmitReview")}
              </Button>
            ) : null}
            {audit.status === "REVIEW" ? (
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={workflowBusy}
                onClick={() => void postComplete()}
              >
                {workflowBusy ? "…" : t("inventory.auditPostComplete")}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
