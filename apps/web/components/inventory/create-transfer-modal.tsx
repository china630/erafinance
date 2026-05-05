"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import { notifyInventoryListsRefresh } from "../../lib/list-refresh-bus";
import {
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import { uuidV4 } from "../../lib/uuid";
import { ProductCombobox, type ProductRow } from "../ui/product-combobox";
import { Button } from "../ui/button";
import { NumericAmountInput } from "../ui/numeric-amount-input";
import { InventoryModalShell } from "./modals/modal-shell";

type Warehouse = { id: string; name: string };

type BinApi = {
  id: string;
  code: string;
  warehouseId: string;
  warehouse?: { id: string; name: string };
};

type LineRow = {
  key: string;
  productId: string;
  quantity: string;
  sourceWarehouseId: string;
  sourceBinId: string;
  targetWarehouseId: string;
  targetBinId: string;
};

const FORM_ID = "inventory-create-transfer-form";

function newLine(): LineRow {
  return {
    key: uuidV4(),
    productId: "",
    quantity: "",
    sourceWarehouseId: "",
    sourceBinId: "",
    targetWarehouseId: "",
    targetBinId: "",
  };
}

function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fieldErrorClass(hasError: boolean) {
  return hasError
    ? `${MODAL_INPUT_CLASS} border-red-500 ring-2 ring-red-500/25`
    : MODAL_INPUT_CLASS;
}

function binsForWarehouse(allBins: BinApi[], warehouseId: string): BinApi[] {
  if (!warehouseId) return [];
  return allBins.filter((b) => b.warehouseId === warehouseId);
}

export type CreateTransferModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function CreateTransferModal({ open, onClose, onSaved }: CreateTransferModalProps) {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [allBins, setAllBins] = useState<BinApi[]>([]);
  const [documentDate, setDocumentDate] = useState(() => todayDateInput());
  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);
  const [productLabels, setProductLabels] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const loadWarehouses = useCallback(async () => {
    const res = await apiFetch("/api/inventory/warehouses");
    if (!res.ok) return;
    const list = (await res.json()) as Warehouse[];
    setWarehouses(Array.isArray(list) ? list : []);
  }, []);

  const loadBins = useCallback(async () => {
    const res = await apiFetch("/api/inventory/bins");
    if (!res.ok) {
      setAllBins([]);
      return;
    }
    const list = (await res.json()) as BinApi[];
    setAllBins(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDocumentDate(todayDateInput());
    setLines([newLine()]);
    setProductLabels({});
    setFieldErrors({});
    setBusy(false);
    void loadWarehouses();
    void loadBins();
  }, [open, loadWarehouses, loadBins]);

  function err(path: string): string | undefined {
    return fieldErrors[path];
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!documentDate?.trim()) {
      next.date = t("inventory.stockTransferValidationDate");
    }
    lines.forEach((row, idx) => {
      const p = `lines.${idx}`;
      if (!row.productId) {
        next[`${p}.productId`] = t("inventory.stockTransferValidationProduct", { line: idx + 1 });
      }
      const qtyNum = Number(String(row.quantity).replace(",", "."));
      if (!row.quantity?.trim() || Number.isNaN(qtyNum) || qtyNum <= 0) {
        next[`${p}.quantity`] = t("inventory.stockTransferValidationQty", { line: idx + 1 });
      }
      if (!row.sourceWarehouseId) {
        next[`${p}.sourceWh`] = t("inventory.stockTransferValidationSourceWh", { line: idx + 1 });
      }
      if (!row.targetWarehouseId) {
        next[`${p}.targetWh`] = t("inventory.stockTransferValidationTargetWh", { line: idx + 1 });
      }
      if (
        row.sourceWarehouseId &&
        row.targetWarehouseId &&
        row.sourceWarehouseId === row.targetWarehouseId &&
        (row.sourceBinId || "") === (row.targetBinId || "")
      ) {
        next[`${p}.route`] = t("inventory.stockTransferValidationSameRoute", { line: idx + 1 });
      }
    });
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const body = {
      date: documentDate,
      lines: lines.map((row) => {
        const qty = Number(String(row.quantity).replace(",", "."));
        const line: {
          productId: string;
          quantity: number;
          sourceWarehouseId: string;
          targetWarehouseId: string;
          sourceBinId?: string;
          targetBinId?: string;
        } = {
          productId: row.productId,
          quantity: qty,
          sourceWarehouseId: row.sourceWarehouseId,
          targetWarehouseId: row.targetWarehouseId,
        };
        if (row.sourceBinId.trim()) line.sourceBinId = row.sourceBinId.trim();
        if (row.targetBinId.trim()) line.targetBinId = row.targetBinId.trim();
        return line;
      }),
    };

    setBusy(true);
    const res = await apiFetch("/api/inventory/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("common.save"));
    notifyInventoryListsRefresh();
    onSaved?.();
    onClose();
  }

  return (
    <InventoryModalShell
      open={open}
      title={t("inventory.stockTransferModalTitle")}
      subtitle={t("inventory.stockTransferModalSubtitle")}
      onClose={onClose}
      maxWidthClass="max-w-6xl"
      footer={
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button
            type="button"
            variant="outline"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={onClose}
            disabled={!!busy}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            className={MODAL_FOOTER_BUTTON_CLASS}
            form={FORM_ID}
            disabled={!!busy}
          >
            {busy ? "…" : t("inventory.stockTransferBtnSave")}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-4 text-[13px]" onSubmit={(e) => void onSubmit(e)}>
        <div className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-4">
          <label htmlFor="transfer-date" className={MODAL_FIELD_LABEL_CLASS}>
            {t("inventory.stockTransferDate")}
          </label>
          <input
            id="transfer-date"
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            className={fieldErrorClass(!!err("date"))}
            aria-invalid={!!err("date")}
          />
          {err("date") ? <p className="mt-1 text-xs text-red-600 m-0">{err("date")}</p> : null}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[13px] font-semibold text-[#34495E]">
              {t("inventory.stockTransferLinesTitle")}
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-[#D5DADF] bg-white px-2 py-1 text-[12px] font-medium text-[#34495E] hover:bg-[#F8F9FA]"
              onClick={() => setLines((prev) => [...prev, newLine()])}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("inventory.stockTransferAddLine")}
            </button>
          </div>

          <div className="relative rounded-lg border border-[#D5DADF] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-[13px]">
                <colgroup>
                  <col className="w-[13rem]" />
                  <col className="w-[6.5rem]" />
                  <col />
                  <col />
                  <col className="w-[2.75rem]" />
                </colgroup>
                <thead className="border-b border-[#D5DADF] bg-[#F8FAFC] text-left text-[#34495E]">
                  <tr>
                    <th className="px-2 py-2 text-xs font-bold text-[#475569]">
                      {t("inventory.stockTransferColProduct")}
                    </th>
                    <th className="px-2 py-2 text-xs font-bold text-[#475569]">
                      {t("inventory.stockTransferColQty")}
                    </th>
                    <th className="px-2 py-2 text-xs font-bold text-[#475569]">
                      {t("inventory.stockTransferColSource")}
                    </th>
                    <th className="px-2 py-2 text-xs font-bold text-[#475569]">
                      {t("inventory.stockTransferColTarget")}
                    </th>
                    <th className="px-1 py-2" aria-label={t("inventory.stockTransferRemoveLine")} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row, idx) => {
                    const srcBins = binsForWarehouse(allBins, row.sourceWarehouseId);
                    const tgtBins = binsForWarehouse(allBins, row.targetWarehouseId);
                    return (
                      <tr key={row.key} className="border-b border-[#ECEFF1] align-top">
                        <td className="px-2 py-2">
                          <ProductCombobox
                            value={row.productId}
                            isService={false}
                            selectedLabel={productLabels[row.key]}
                            className="w-full min-w-0"
                            listClassName="min-w-[14rem]"
                            portaled
                            onChange={(id, item: ProductRow | null) => {
                              setLines((prev) =>
                                prev.map((r) => (r.key === row.key ? { ...r, productId: id } : r)),
                              );
                              setProductLabels((prev) => {
                                const next = { ...prev };
                                if (!id || !item) delete next[row.key];
                                else {
                                  const label =
                                    item.name?.trim() && item.sku?.trim()
                                      ? `${item.name.trim()} (${String(item.sku).trim()})`
                                      : item.name?.trim() || String(item.sku ?? "").trim() || id;
                                  next[row.key] = label;
                                }
                                return next;
                              });
                            }}
                            aria-invalid={!!err(`lines.${idx}.productId`)}
                          />
                          {err(`lines.${idx}.productId`) ? (
                            <p className="mt-1 text-[11px] text-red-600 m-0">
                              {err(`lines.${idx}.productId`)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <NumericAmountInput
                            value={row.quantity}
                            onValueChange={(v) =>
                              setLines((prev) =>
                                prev.map((r) => (r.key === row.key ? { ...r, quantity: v } : r)),
                              )
                            }
                            className={fieldErrorClass(!!err(`lines.${idx}.quantity`))}
                            aria-invalid={!!err(`lines.${idx}.quantity`)}
                          />
                          {err(`lines.${idx}.quantity`) ? (
                            <p className="mt-1 text-[11px] text-red-600 m-0">
                              {err(`lines.${idx}.quantity`)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1.5">
                            <div>
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                                {t("inventory.stockTransferWhShort")}
                              </span>
                              <select
                                value={row.sourceWarehouseId}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setLines((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? { ...r, sourceWarehouseId: v, sourceBinId: "" }
                                        : r,
                                    ),
                                  );
                                }}
                                className={fieldErrorClass(!!err(`lines.${idx}.sourceWh`))}
                                aria-invalid={!!err(`lines.${idx}.sourceWh`)}
                              >
                                <option value="">{t("inventory.whSelect")}</option>
                                {warehouses.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                                {t("inventory.stockTransferBinShort")}
                              </span>
                              <select
                                value={row.sourceBinId}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key ? { ...r, sourceBinId: e.target.value } : r,
                                    ),
                                  )
                                }
                                className={MODAL_INPUT_CLASS}
                                disabled={!row.sourceWarehouseId}
                              >
                                <option value="">{t("inventory.stockTransferBinNone")}</option>
                                {srcBins.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.code}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {err(`lines.${idx}.sourceWh`) ? (
                            <p className="mt-1 text-[11px] text-red-600 m-0">
                              {err(`lines.${idx}.sourceWh`)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1.5">
                            <div>
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                                {t("inventory.stockTransferWhShort")}
                              </span>
                              <select
                                value={row.targetWarehouseId}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setLines((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? { ...r, targetWarehouseId: v, targetBinId: "" }
                                        : r,
                                    ),
                                  );
                                }}
                                className={fieldErrorClass(!!err(`lines.${idx}.targetWh`))}
                                aria-invalid={!!err(`lines.${idx}.targetWh`)}
                              >
                                <option value="">{t("inventory.whSelect")}</option>
                                {warehouses.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                                {t("inventory.stockTransferBinShort")}
                              </span>
                              <select
                                value={row.targetBinId}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key ? { ...r, targetBinId: e.target.value } : r,
                                    ),
                                  )
                                }
                                className={MODAL_INPUT_CLASS}
                                disabled={!row.targetWarehouseId}
                              >
                                <option value="">{t("inventory.stockTransferBinNone")}</option>
                                {tgtBins.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.code}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {err(`lines.${idx}.targetWh`) ? (
                            <p className="mt-1 text-[11px] text-red-600 m-0">
                              {err(`lines.${idx}.targetWh`)}
                            </p>
                          ) : null}
                          {err(`lines.${idx}.route`) ? (
                            <p className="mt-1 text-[11px] text-red-600 m-0">
                              {err(`lines.${idx}.route`)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-1 py-2 text-center">
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            onClick={() => {
                              if (lines.length <= 1) return;
                              setLines((prev) => prev.filter((r) => r.key !== row.key));
                              setProductLabels((prev) => {
                                const next = { ...prev };
                                delete next[row.key];
                                return next;
                              });
                            }}
                            disabled={lines.length <= 1}
                            aria-label={t("inventory.stockTransferRemoveLine")}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </form>
    </InventoryModalShell>
  );
}
