"use client";

import Link from "next/link";
import { Trash2, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { notifyListRefresh } from "../../../lib/list-refresh-bus";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  INPUT_BORDERED_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { Button } from "../../ui/button";

type Warehouse = { id: string; name: string };
type Product = { id: string; name: string; sku: string; isService?: boolean };
type StockRow = { quantity: unknown; product: Product };
type Line = { productId: string; actualQty: string };

const DOC_TYPES = ["WRITE_OFF", "SURPLUS"] as const;

export function PhysicalAdjustmentModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const { token } = useRequireAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]>("WRITE_OFF");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", actualQty: "0" }]);
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const productGoods = useMemo(() => products.filter((p) => !p.isService), [products]);

  const bookByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of stockRows) {
      m.set(r.product.id, Number(r.quantity));
    }
    return m;
  }, [stockRows]);

  const resetForm = useCallback(() => {
    setDate(new Date().toISOString().slice(0, 10));
    setDocType("WRITE_OFF");
    setReason("");
    setLines([{ productId: "", actualQty: "0" }]);
    setDraftId(null);
    setMessage(null);
  }, []);

  const loadWarehousesProducts = useCallback(async () => {
    if (!token) return;
    const [w, p] = await Promise.all([
      apiFetch("/api/inventory/warehouses"),
      apiFetch("/api/products"),
    ]);
    if (w.ok) {
      const list = (await w.json()) as Warehouse[];
      setWarehouses(list);
      setWarehouseId((prev) => (prev && list.some((x) => x.id === prev) ? prev : list[0]?.id ?? ""));
    }
    if (p.ok) {
      setProducts((await p.json()) as Product[]);
    }
  }, [token]);

  const loadStock = useCallback(async () => {
    if (!token || !warehouseId) return;
    const res = await apiFetch(
      `/api/inventory/stock?warehouseId=${encodeURIComponent(warehouseId)}`,
    );
    if (res.ok) {
      setStockRows((await res.json()) as StockRow[]);
    }
  }, [token, warehouseId]);

  useEffect(() => {
    if (!open || !token) return;
    resetForm();
    void loadWarehousesProducts();
  }, [open, token, loadWarehousesProducts, resetForm]);

  useEffect(() => {
    if (!open || !warehouseId) return;
    void loadStock();
  }, [open, loadStock, warehouseId]);

  if (!open) return null;

  function addLine() {
    const first = productGoods[0]?.id ?? "";
    setLines((prev) => [...prev, { productId: first, actualQty: "0" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, j) => j !== i));
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  async function onSaveDraft(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!token || !warehouseId) {
      alert(t("inventory.physicalNeedWh"));
      return;
    }
    const payloadLines: { productId: string; actualQuantity: number }[] = [];
    for (const row of lines) {
      const q = Number(row.actualQty);
      if (!row.productId || !Number.isFinite(q) || q < 0) continue;
      payloadLines.push({ productId: row.productId, actualQuantity: q });
    }
    if (payloadLines.length === 0) {
      alert(t("inventory.physicalNeedLines"));
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/inventory/physical-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          date,
          docType,
          reason: reason.trim() || undefined,
          lines: payloadLines,
        }),
      });
      if (!res.ok) {
        setMessage((await res.text()).slice(0, 400));
        return;
      }
      const created = (await res.json()) as { id: string };
      setDraftId(created.id);
      setMessage(t("inventory.physicalDraftOk"));
      notifyListRefresh("inventory-physical");
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  async function onPost() {
    if (!token || !draftId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch(
        `/api/inventory/physical-adjustments/${encodeURIComponent(draftId)}/post`,
        { method: "POST" },
      );
      if (!res.ok) {
        setMessage((await res.text()).slice(0, 400));
        return;
      }
      setMessage(t("inventory.physicalPostedOk"));
      notifyListRefresh("inventory-physical");
      onSaved?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`${MODAL_DIALOG_CONTENT_CLASS} flex max-h-[min(92vh,52rem)] max-w-4xl flex-col`}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex shrink-0 items-start justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold text-[#34495E]">{t("inventory.physicalNewBtn")}</h2>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </header>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <p className="m-0 mb-4 text-[12px] text-[#7F8C8D]">
            {t("inventory.physicalVsAuditLead")}{" "}
            <Link href="/inventory/audits" className={LINK_ACCENT_CLASS}>
              {t("inventory.physicalVsAuditLink")}
            </Link>
            {t("inventory.physicalVsAuditTail")}
          </p>
          <form onSubmit={onSaveDraft} className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium text-[#34495E]">{t("inventory.whSelect")}</span>
                <select
                  className={INPUT_BORDERED_CLASS}
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                >
                  <option value="">{t("inventory.chooseWarehouse")}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium text-[#34495E]">{t("inventory.physicalDocDate")}</span>
                <input
                  type="date"
                  className={INPUT_BORDERED_CLASS}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium text-[#34495E]">{t("inventory.physicalDocType")}</span>
                <select
                  className={INPUT_BORDERED_CLASS}
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPES)[number])}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {t(`inventory.physicalDocType_${d}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[13px] md:col-span-2">
                <span className="font-medium text-[#34495E]">{t("inventory.physicalReason")}</span>
                <input
                  type="text"
                  className={INPUT_BORDERED_CLASS}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("inventory.physicalReasonPh")}
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#34495E]">
                {t("inventory.physicalLines")}
              </span>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={addLine}>
                + {t("inventory.transferAddLine")}
              </button>
            </div>

            <div className={`${DATA_TABLE_VIEWPORT_CLASS} rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-2`}>
              <table className={`${DATA_TABLE_CLASS} w-full min-w-[640px]`}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thProduct")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.physicalBookQty")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.physicalActualQty")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.physicalDelta")}</th>
                    <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-12`} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row, i) => {
                    const book = bookByProduct.get(row.productId);
                    const bookN = book != null && Number.isFinite(book) ? book : null;
                    const act = Number(row.actualQty);
                    const delta =
                      row.productId && Number.isFinite(act) && bookN != null ? act - bookN : null;
                    return (
                      <tr key={i} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <select
                            className={`${INPUT_BORDERED_CLASS} w-full max-w-xs`}
                            value={row.productId}
                            onChange={(e) => updateLine(i, { productId: e.target.value })}
                          >
                            <option value="">{t("inventory.transferPickProduct")}</option>
                            {productGoods.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          {row.productId ? (bookN != null ? bookN : "0") : "—"}
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className={`${MODAL_INPUT_NUMERIC_CLASS} ml-auto max-w-[8rem]`}
                            value={row.actualQty}
                            onChange={(e) => updateLine(i, { actualQty: e.target.value })}
                          />
                        </td>
                        <td className={`${DATA_TABLE_TD_RIGHT_CLASS} font-semibold`}>
                          {delta != null && Number.isFinite(delta) ? delta : "—"}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {lines.length > 1 ? (
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              onClick={() => removeLine(i)}
                            >
                              <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500">{t("inventory.physicalDeltaNote")}</p>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                {busy ? "…" : t("inventory.physicalSaveDraft")}
              </button>
              {draftId ? (
                <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={onPost}>
                  {busy ? "…" : t("inventory.physicalPost")}
                </button>
              ) : null}
            </div>
            {message ? (
              <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                {message}
              </pre>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
