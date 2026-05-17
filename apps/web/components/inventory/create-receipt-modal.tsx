"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import { parsePaginatedList } from "../../lib/paginated-list";
import { notifyInventoryListsRefresh } from "../../lib/list-refresh-bus";
import {
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import { uuidV4 } from "../../lib/uuid";
import { AsyncCombobox } from "../ui/async-combobox";
import { Button } from "../ui/button";
import { NumericAmountInput } from "../ui/numeric-amount-input";
import { InventoryModalShell } from "./modals/modal-shell";

type Product = { id: string; name: string; sku: string; isService?: boolean };

type Warehouse = { id: string; name: string };

type BinRow = { id: string; code: string };

type BinOpt = { id: string; code: string };

type PurchaseInvoiceRow = {
  id: string;
  documentDate: string;
  kind: string;
  totalGross: string;
};

type PurchaseInvoiceDetailLine = {
  kind: "goods" | "services";
  productId: string;
  quantity: number;
  productName: string;
  sku: string;
};

type LineRow = {
  key: string;
  productId: string;
  quantity: string;
  binId: string;
};

const FORM_ID = "inventory-create-receipt-form";

const BIN_NONE_ID = "__none__";

function newLine(): LineRow {
  return { key: uuidV4(), productId: "", quantity: "", binId: "" };
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

function basisKindTag(kind: string, t: (k: string) => string): string {
  if (kind === "dual") return t("inventory.purchaseKindDual");
  if (kind === "services") return t("inventory.purchaseKindServices");
  return t("inventory.purchaseKindGoods");
}

export type CreateReceiptModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Posted alış fakturası (Transaction.id); goods lines autofill from API snapshot. */
  initialBasisTransactionId?: string;
};

export function CreateReceiptModal({
  open,
  onClose,
  onSaved,
  initialBasisTransactionId,
}: CreateReceiptModalProps) {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bins, setBins] = useState<BinRow[]>([]);
  const [basisOptions, setBasisOptions] = useState<PurchaseInvoiceRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [documentDate, setDocumentDate] = useState(() => todayDateInput());
  const [basisTransactionId, setBasisTransactionId] = useState("");
  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);
  const [productLabels, setProductLabels] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [basisLinesLoading, setBasisLinesLoading] = useState(false);
  const basisFetchSeqRef = useRef(0);

  const loadWarehouses = useCallback(async () => {
    const res = await apiFetch("/api/inventory/warehouses");
    if (!res.ok) return;
    const list = (await res.json()) as Warehouse[];
    setWarehouses(Array.isArray(list) ? list : []);
  }, []);

  const loadBasis = useCallback(async () => {
    const res = await apiFetch("/api/inventory/purchase-invoices?page=1&pageSize=200");
    if (!res.ok) return;
    const parsed = parsePaginatedList<PurchaseInvoiceRow>(await res.json());
    const list = parsed.items.filter((r) => r.kind === "goods" || r.kind === "dual");
    setBasisOptions(list);
  }, []);

  const loadBins = useCallback(async (whId: string) => {
    if (!whId) {
      setBins([]);
      return;
    }
    const q = new URLSearchParams({ warehouseId: whId });
    const res = await apiFetch(`/api/inventory/bins?${q.toString()}`);
    if (!res.ok) {
      setBins([]);
      return;
    }
    const list = (await res.json()) as BinRow[];
    setBins(Array.isArray(list) ? list : []);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    setWarehouseId("");
    setDocumentDate(todayDateInput());
    setBasisTransactionId(initialBasisTransactionId ?? "");
    setLines([newLine()]);
    setProductLabels({});
    setFieldErrors({});
    setBins([]);
    setBusy(false);
    setBasisLinesLoading(false);
    void loadWarehouses();
    void loadBasis();
  }, [open, initialBasisTransactionId, loadWarehouses, loadBasis]);

  useEffect(() => {
    if (!open) return;
    void loadBins(warehouseId);
  }, [open, warehouseId, loadBins]);

  useEffect(() => {
    if (!open) {
      basisFetchSeqRef.current += 1;
      setBasisLinesLoading(false);
      return;
    }
    const id = basisTransactionId.trim();
    if (!id) {
      basisFetchSeqRef.current += 1;
      setBasisLinesLoading(false);
      setLines([newLine()]);
      setProductLabels({});
      return;
    }
    const seq = ++basisFetchSeqRef.current;
    setBasisLinesLoading(true);
    void (async () => {
      try {
        const res = await apiFetch(`/api/inventory/purchase-invoices/${encodeURIComponent(id)}`);
        if (seq !== basisFetchSeqRef.current) return;
        if (!res.ok) {
          toast.error(t("common.loadErr"), { description: await res.text() });
          setLines([newLine()]);
          setProductLabels({});
          return;
        }
        const data = (await res.json()) as { lines?: PurchaseInvoiceDetailLine[] };
        const goods = (data.lines ?? []).filter((l) => l.kind === "goods");
        if (goods.length === 0) {
          toast.info(t("inventory.receiptBasisLinesMissing"));
          setLines([newLine()]);
          setProductLabels({});
          return;
        }
        const labels: Record<string, string> = {};
        const newLines: LineRow[] = goods.map((l) => {
          const key = uuidV4();
          const label =
            l.productName.trim() && l.sku.trim()
              ? `${l.productName.trim()} (${l.sku.trim()})`
              : l.productName.trim() || l.sku.trim() || "";
          labels[key] = label;
          return {
            key,
            productId: l.productId,
            quantity: String(l.quantity),
            binId: "",
          };
        });
        setLines(newLines);
        setProductLabels(labels);
        setFieldErrors({});
      } finally {
        if (seq === basisFetchSeqRef.current) {
          setBasisLinesLoading(false);
        }
      }
    })();
  }, [open, basisTransactionId, t]);

  function err(path: string): string | undefined {
    return fieldErrors[path];
  }

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(`lines.${i}.`)) delete next[k];
      }
      return next;
    });
  }

  const fetchBinsForCombobox = useCallback(
    async (query: string): Promise<BinOpt[]> => {
      const none: BinOpt = { id: BIN_NONE_ID, code: t("inventory.receiptBinNone") };
      if (!warehouseId) return [none];
      const q = query.trim().toLowerCase();
      const filtered = bins.filter((b) => !q || b.code.toLowerCase().includes(q));
      return [none, ...filtered.map((b) => ({ id: b.id, code: b.code }))];
    },
    [warehouseId, bins, t],
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!warehouseId) {
      next.warehouseId = t("inventory.receiptValidationWarehouse");
    }
    if (!documentDate?.trim()) {
      next.date = t("inventory.receiptValidationDate");
    }
    const seen = new Set<string>();
    lines.forEach((row, idx) => {
      if (!row.productId) {
        next[`lines.${idx}.productId`] = t("inventory.receiptValidationLineProduct", {
          line: idx + 1,
        });
      } else if (seen.has(row.productId)) {
        next[`lines.${idx}.productId`] = t("inventory.receiptValidationDuplicateProduct");
      } else {
        seen.add(row.productId);
      }
      const qtyNum = Number(String(row.quantity).replace(",", "."));
      if (!row.quantity?.trim() || Number.isNaN(qtyNum) || qtyNum <= 0) {
        next[`lines.${idx}.quantity`] = t("inventory.receiptValidationLineQty", { line: idx + 1 });
      }
    });
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const body: {
      warehouseId: string;
      date: string;
      basisTransactionId?: string;
      lines: Array<{ productId: string; quantity: number; binId?: string }>;
    } = {
      warehouseId,
      date: documentDate,
      lines: lines.map((row) => {
        const qty = Number(String(row.quantity).replace(",", "."));
        const line: { productId: string; quantity: number; binId?: string } = {
          productId: row.productId,
          quantity: qty,
        };
        if (row.binId) line.binId = row.binId;
        return line;
      }),
    };
    if (basisTransactionId) {
      body.basisTransactionId = basisTransactionId;
    }

    setBusy(true);
    const res = await apiFetch("/api/inventory/receipts", {
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

  const fetchProducts = async (search: string) => {
    const q = new URLSearchParams();
    q.set("isService", "false");
    q.set("limit", "20");
    const trimmed = search.trim();
    if (trimmed) q.set("search", trimmed);
    const res = await apiFetch(`/api/products?${q}`);
    if (!res.ok) return [];
    const list = (await res.json()) as Product[];
    return Array.isArray(list) ? list : [];
  };

  return (
    <InventoryModalShell
      open={open}
      title={t("inventory.receiptModalTitle")}
      subtitle={t("inventory.receiptModalSubtitle")}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      footer={
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button
            type="button"
            variant="outline"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={onClose}
            disabled={!!busy}
          >
            {t("inventory.receiptBtnCancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            className={MODAL_FOOTER_BUTTON_CLASS}
            form={FORM_ID}
            disabled={!!busy || basisLinesLoading}
          >
            {busy || basisLinesLoading ? "…" : t("inventory.receiptBtnSave")}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-4 text-[13px]" onSubmit={(e) => void onSubmit(e)}>
        <div className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="receipt-date" className={MODAL_FIELD_LABEL_CLASS}>
                {t("inventory.receiptDate")}
              </label>
              <input
                id="receipt-date"
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className={fieldErrorClass(!!err("date"))}
                aria-invalid={!!err("date")}
              />
              {err("date") ? <p className="mt-1 text-xs text-red-600 m-0">{err("date")}</p> : null}
            </div>
            <div>
              <label htmlFor="receipt-wh" className={MODAL_FIELD_LABEL_CLASS}>
                {t("inventory.receiptWarehouse")}
              </label>
              <select
                id="receipt-wh"
                value={warehouseId}
                onChange={(e) => {
                  const v = e.target.value;
                  setWarehouseId(v);
                  setLines((prev) => prev.map((r) => ({ ...r, binId: "" })));
                }}
                className={fieldErrorClass(!!err("warehouseId"))}
                aria-invalid={!!err("warehouseId")}
              >
                <option value="">{t("inventory.whSelect")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              {err("warehouseId") ? (
                <p className="mt-1 text-xs text-red-600 m-0">{err("warehouseId")}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="receipt-basis" className={MODAL_FIELD_LABEL_CLASS}>
              {t("inventory.receiptBasis")}
            </label>
            <select
              id="receipt-basis"
              value={basisTransactionId}
              onChange={(e) => setBasisTransactionId(e.target.value)}
              className={MODAL_INPUT_CLASS}
              disabled={basisOptions.length === 0 || basisLinesLoading}
            >
              <option value="">{t("inventory.receiptBasisNone")}</option>
              {basisOptions.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.documentDate.slice(0, 10)} · {basisKindTag(inv.kind, t)}
                </option>
              ))}
            </select>
            {basisOptions.length === 0 ? (
              <p className="mt-1 text-[12px] text-[#7F8C8D] m-0">{t("inventory.receiptBasisEmptyHint")}</p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-[#34495E] m-0">
            {t("inventory.receiptLinesTitle")}
          </p>
          <div className="relative rounded-lg border border-[#D5DADF] bg-white shadow-sm">
            {basisLinesLoading ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/75 text-[13px] text-[#34495E]"
                aria-busy="true"
              >
                <Loader2 className="h-8 w-8 shrink-0 animate-spin text-[#2980B9]" aria-hidden />
                <span>{t("inventory.receiptBasisLinesLoading")}</span>
              </div>
            ) : null}
            <div className="overflow-x-auto max-h-[min(55vh,22rem)] overflow-y-auto">
              <table className="w-full min-w-[640px] table-fixed border-collapse text-[13px]">
                <colgroup>
                  <col />
                  <col className="w-[7rem]" />
                  <col className="w-[11rem]" />
                  <col className="w-[2.75rem]" />
                </colgroup>
                <thead className="border-b border-[#D5DADF] bg-[#F8FAFC] text-left text-[#34495E]">
                  <tr>
                    <th className="px-3 py-2 text-xs font-bold text-[#475569]">
                      {t("inventory.receiptColProduct")}
                    </th>
                    <th className="px-3 py-2 text-xs font-bold text-[#475569]">
                      {t("inventory.receiptColQty")}
                    </th>
                    <th className="px-3 py-2 text-xs font-bold text-[#475569]">
                      {t("inventory.receiptColBin")}
                    </th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row, idx) => (
                    <tr
                      key={row.key}
                      className="border-b border-[#D5DADF] bg-white transition-colors hover:bg-[#F1F5F9] last:border-b-0"
                    >
                      <td className="px-3 py-2 align-middle min-w-0">
                        <AsyncCombobox<Product>
                          value={row.productId}
                          onChange={(id, item) => {
                            updateLine(idx, { productId: id });
                            setProductLabels((prev) => ({
                              ...prev,
                              [row.key]: item ? `${item.name} (${item.sku})` : "",
                            }));
                          }}
                          fetcher={fetchProducts}
                          getOptionLabel={(p) => `${p.name} (${p.sku})`}
                          placeholder={t("common.emptyValue")}
                          selectedLabel={productLabels[row.key] ?? ""}
                          className="min-w-0"
                          listClassName="min-w-[14rem] z-[200]"
                          portaled
                          disabled={basisLinesLoading}
                          aria-invalid={!!err(`lines.${idx}.productId`)}
                        />
                        {err(`lines.${idx}.productId`) ? (
                          <p className="mt-1 text-xs text-red-600 m-0">
                            {err(`lines.${idx}.productId`)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <NumericAmountInput
                          value={row.quantity}
                          onValueChange={(plain) => updateLine(idx, { quantity: plain })}
                          decimalScale={4}
                          disabled={basisLinesLoading}
                          className={
                            err(`lines.${idx}.quantity`)
                              ? "border-red-500 ring-2 ring-red-500/25"
                              : ""
                          }
                          aria-invalid={!!err(`lines.${idx}.quantity`)}
                        />
                        {err(`lines.${idx}.quantity`) ? (
                          <p className="mt-1 text-xs text-red-600 m-0">
                            {err(`lines.${idx}.quantity`)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <AsyncCombobox<BinOpt>
                          value={row.binId || BIN_NONE_ID}
                          onChange={(id) => {
                            updateLine(idx, { binId: id === BIN_NONE_ID ? "" : id });
                          }}
                          fetcher={fetchBinsForCombobox}
                          getOptionLabel={(b) => b.code}
                          placeholder={t("inventory.receiptBinPickPlaceholder")}
                          selectedLabel={
                            row.binId
                              ? (bins.find((b) => b.id === row.binId)?.code ?? "")
                              : t("inventory.receiptBinNone")
                          }
                          className="min-w-0"
                          listClassName="min-w-[10rem] z-[200]"
                          portaled
                          disabled={!warehouseId || basisLinesLoading}
                          aria-label={t("inventory.receiptColBin")}
                        />
                      </td>
                      <td className="px-2 py-2 align-middle text-center">
                        <button
                          type="button"
                          className={`${TABLE_ROW_ICON_BTN_CLASS} text-[#E74C3C]`}
                          title={t("inventory.receiptRemoveLine")}
                          disabled={basisLinesLoading}
                          onClick={() => {
                            if (lines.length <= 1) return;
                            setLines((prev) => prev.filter((_, j) => j !== idx));
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              for (const k of Object.keys(next)) {
                                if (k.startsWith(`lines.${idx}.`)) delete next[k];
                              }
                              return next;
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={basisLinesLoading}
          onClick={() => setLines((prev) => [...prev, newLine()])}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          {t("inventory.receiptAddLine")}
        </Button>
      </form>
    </InventoryModalShell>
  );
}
