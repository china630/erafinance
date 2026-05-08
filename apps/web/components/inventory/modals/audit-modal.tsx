"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import {
  notifyInventoryListsRefresh,
  notifyListRefresh,
} from "../../../lib/list-refresh-bus";
import { useRequireAuth } from "../../../lib/use-require-auth";
import {
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
} from "../../../lib/design-system";
import { Button } from "../../ui/button";
import { InventoryModalFooter, InventoryModalShell } from "./modal-shell";

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

export function AuditModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const pendingTimers = useRef<Record<string, number>>({});
  const auditRef = useRef<AuditDetail | null>(null);
  useEffect(() => {
    auditRef.current = audit;
  }, [audit]);

  const dateStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const loadWarehouses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const res = await apiFetch("/api/inventory/warehouses");
    if (!res.ok) {
      setError(`${t("inventory.loadErr")}: ${res.status}`);
      setWarehouses([]);
    } else {
      const data = (await res.json()) as WarehouseRow[];
      setWarehouses(data);
      setWarehouseId((cur) => (cur && data.some((w) => w.id === cur) ? cur : data[0]?.id ?? ""));
    }
    setLoading(false);
  }, [token, t]);

  useEffect(() => {
    if (!open || !ready || !token) return;
    setAudit(null);
    setError(null);
    void loadWarehouses();
  }, [open, ready, token, loadWarehouses]);

  useEffect(() => {
    if (!open) return;
    return () => {
      Object.values(pendingTimers.current).forEach((id) => window.clearTimeout(id));
      pendingTimers.current = {};
    };
  }, [open]);

  async function createDraft() {
    if (!token || creating) return;
    if (loading) return;
    if (!warehouseId) {
      toast.error(t("inventory.auditSelectWarehouse"));
      return;
    }
    setCreating(true);
    setError(null);
    const res = await apiFetch("/api/inventory/reconciliations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateStr, warehouseId }),
    });
    if (!res.ok) {
      setCreating(false);
      const msg = await res.text();
      setError(msg);
      toast.error(t("common.saveErr"), { description: msg });
      return;
    }
    const created = (await res.json()) as AuditDetail;
    const startRes = await apiFetch(
      `/api/inventory/reconciliations/${encodeURIComponent(created.id)}/start`,
      { method: "POST" },
    );
    setCreating(false);
    if (!startRes.ok) {
      const msg = await startRes.text();
      setError(msg);
      toast.error(t("common.saveErr"), { description: msg });
      setAudit(created);
      notifyListRefresh("inventory-audits");
      return;
    }
    const detail = await apiFetch(`/api/inventory/reconciliations/${encodeURIComponent(created.id)}`);
    if (detail.ok) {
      setAudit((await detail.json()) as AuditDetail);
      toast.success(t("inventory.auditOkDraft"));
    } else {
      setError(await detail.text());
    }
    notifyListRefresh("inventory-audits");
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
      const msg = await res.text();
      setError(msg);
      toast.error(t("common.saveErr"), { description: msg });
      return;
    }
    const updated = await apiFetch(`/api/inventory/reconciliations/${encodeURIComponent(audit.id)}`);
    if (updated.ok) setAudit((await updated.json()) as AuditDetail);
    notifyListRefresh("inventory-audits");
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
      notifyListRefresh("inventory-audits");
      notifyInventoryListsRefresh();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(t("common.saveErr"), { description: msg });
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
        .then(async () => {})
        .catch(() => {})
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

  if (!open) return null;

  const footerDraft = (
    <InventoryModalFooter onCancel={onClose} onSave={() => void createDraft()} busy={creating} />
  );

  const footerWorkflow = audit ? (
    <div className={MODAL_FOOTER_ACTIONS_CLASS}>
      <Button
        type="button"
        variant="outline"
        className={MODAL_FOOTER_BUTTON_CLASS}
        onClick={onClose}
        disabled={!!workflowBusy}
      >
        {t("common.cancel")}
      </Button>
      {audit.status === "COUNTING" ? (
        <Button
          type="button"
          variant="primary"
          className={MODAL_FOOTER_BUTTON_CLASS}
          disabled={!!workflowBusy}
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
          disabled={!!workflowBusy}
          onClick={() => void postComplete()}
        >
          {workflowBusy ? "…" : t("inventory.auditPostComplete")}
        </Button>
      ) : null}
      {audit.status === "COMPLETED" || audit.status === "CANCELLED" ? (
        <Button type="button" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} onClick={onClose}>
          {t("common.close")}
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <InventoryModalShell
      open={open}
      title={t("inventory.auditTitle")}
      subtitle={t("inventory.auditSubtitle")}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
      footer={audit ? footerWorkflow : footerDraft}
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>}

      {!loading && warehouses.length === 0 && !error && (
        <p className="text-[13px] text-[#7F8C8D]">{t("inventory.auditEmpty")}</p>
      )}

      {!loading && warehouses.length > 0 && !audit && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("inventory.thWh")}
            <select
              className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
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
      )}

      {audit && (
        <>
          <section className={`overflow-x-auto rounded-2xl border border-[#D5DADF] bg-white shadow-sm`}>
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#EBEDF0]">
                  <th className="p-2 text-left">{t("inventory.thProduct")}</th>
                  <th className="p-2 text-left">{t("inventory.thSku")}</th>
                  <th className="p-2 text-right">{t("inventory.auditThSystem")}</th>
                  <th className="p-2 text-right">{t("inventory.auditThFact")}</th>
                  <th className="p-2 text-right">{t("inventory.auditThDiff")}</th>
                  <th className="p-2 text-right">{t("inventory.auditThCost")}</th>
                  <th className="p-2 text-right">{t("inventory.auditThAmountDiff")}</th>
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
                    <tr key={l.id} className="border-t border-[#EBEDF0]">
                      <td className="p-2">{l.product?.name ?? l.productId}</td>
                      <td className="p-2 font-mono text-[13px]">{l.product?.sku ?? t("common.emptyValue")}</td>
                      <td className="p-2 text-right tabular-nums text-slate-600">{numStr(l.systemQty)}</td>
                      <td className="p-2 text-right">
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
                                    lines: cur.lines.map((x) =>
                                      x.id === l.id ? { ...x, factQty: v } : x,
                                    ),
                                  },
                            );
                            patchLineDebounced(l.id, { factQty: v });
                          }}
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums">{diff.toFixed(2)}</td>
                      <td className="p-2 text-right">
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
                                    lines: cur.lines.map((x) =>
                                      x.id === l.id ? { ...x, costPrice: v } : x,
                                    ),
                                  },
                            );
                            patchLineDebounced(l.id, { costPrice: v });
                          }}
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {amt.toFixed(2)}
                        {savingLineId === l.id ? <span className="ml-2 text-xs text-slate-400">…</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[13px] text-[#7F8C8D]">
              {t("inventory.auditTotalDiff")}:{" "}
              <span className="font-semibold tabular-nums">{totals.sumAbs.toFixed(2)}</span>
            </p>
          </div>
          <p className="mt-2 text-[13px] text-[#7F8C8D]">{t("inventory.auditApproveHint")}</p>
        </>
      )}
    </InventoryModalShell>
  );
}
