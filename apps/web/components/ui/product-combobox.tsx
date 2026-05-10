"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
} from "../../lib/design-system";
import { AsyncCombobox } from "./async-combobox";
import { Button } from "./button";

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  price?: unknown;
  vatRate?: unknown;
  isService?: boolean;
};

type UnitOfMeasureRow = {
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
};

type ProductComboboxProps = {
  value: string;
  onChange: (id: string, item: ProductRow | null) => void;
  isService: boolean;
  selectedLabel?: string;
  className?: string;
  listClassName?: string;
  portaled?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
  enableQuickCreate?: boolean;
};

export function ProductCombobox({
  value,
  onChange,
  isService,
  selectedLabel = "",
  className = "",
  listClassName = "",
  portaled = true,
  disabled = false,
  "aria-invalid": ariaInvalid,
  enableQuickCreate = true,
}: ProductComboboxProps) {
  const { t } = useTranslation();
  const dialogTitleId = useId();
  const [quickOpen, setQuickOpen] = useState(false);
  const [qcName, setQcName] = useState("");
  const [qcUnitCode, setQcUnitCode] = useState("");
  const [uoms, setUoms] = useState<UnitOfMeasureRow[]>([]);
  const [qcBusy, setQcBusy] = useState(false);

  useEffect(() => {
    if (!quickOpen) return;
    setQcName("");
    setQcUnitCode("");
    setQcBusy(false);
  }, [quickOpen]);

  useEffect(() => {
    if (!quickOpen) return;
    let alive = true;
    (async () => {
      const res = await apiFetch("/api/system/units-of-measure");
      if (!res.ok) return;
      const rows = (await res.json()) as UnitOfMeasureRow[];
      if (alive) setUoms(Array.isArray(rows) ? rows : []);
    })();
    return () => {
      alive = false;
    };
  }, [quickOpen]);

  const fetchProducts = useCallback(
    async (search: string) => {
      const q = new URLSearchParams();
      q.set("isService", isService ? "true" : "false");
      q.set("limit", "20");
      const trimmed = search.trim();
      if (trimmed) q.set("search", trimmed);
      const res = await apiFetch(`/api/products?${q}`);
      if (!res.ok) return [];
      const list = (await res.json()) as ProductRow[];
      return Array.isArray(list) ? list : [];
    },
    [isService],
  );

  const getOptionLabel = useCallback(
    (p: ProductRow) => (p.isService ? p.name : `${p.name} (${p.sku})`),
    [],
  );

  async function submitQuickCreate() {
    const name = qcName.trim();
    if (!name) {
      toast.error(t("ui.productQuickCreateNameRequired"));
      return;
    }
    setQcBusy(true);
    const sku =
      isService ? undefined : `QC-${Date.now()}`;
    const res = await apiFetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sku,
        unitOfMeasureCode: qcUnitCode || undefined,
        price: 0,
        vatRate: 18,
        isService,
      }),
    });
    setQcBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    const created = (await res.json()) as ProductRow;
    toast.success(t("common.save"));
    setQuickOpen(false);
    onChange(created.id, created);
  }

  return (
    <>
      <div className={["flex min-w-0 items-stretch gap-1.5", className].filter(Boolean).join(" ")}>
        <div className="min-w-0 flex-1">
          <AsyncCombobox<ProductRow>
            value={value}
            onChange={onChange}
            fetcher={fetchProducts}
            getOptionLabel={getOptionLabel}
            placeholder={t("common.emptyValue")}
            selectedLabel={selectedLabel}
            listClassName={listClassName}
            portaled={portaled}
            disabled={disabled}
            aria-invalid={ariaInvalid}
          />
        </div>
        {enableQuickCreate && !disabled ? (
          <Button
            type="button"
            variant="ghost"
            className="!h-9 !min-h-9 !w-9 shrink-0 !rounded-lg !px-0 text-[#2980B9] border border-[#D5DADF] bg-white shadow-sm"
            title={t("ui.productQuickCreateOpen")}
            aria-label={t("ui.productQuickCreateOpen")}
            onClick={() => setQuickOpen(true)}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        ) : null}
      </div>

      {quickOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/50 p-4">
              <div
                className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md w-full`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 id={dialogTitleId} className="m-0 text-lg font-semibold text-[#34495E]">
                    {isService ? t("ui.productQuickCreateTitleService") : t("ui.productQuickCreateTitleGoods")}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!h-8 !min-h-8 !w-8 !shrink-0 !rounded-lg !px-0 text-[#7F8C8D]"
                    aria-label={t("common.close")}
                    onClick={() => setQuickOpen(false)}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className={MODAL_FIELD_LABEL_CLASS}>{t("ui.productQuickCreateName")}</span>
                    <input
                      value={qcName}
                      onChange={(e) => setQcName(e.target.value)}
                      className={MODAL_INPUT_CLASS}
                      autoFocus
                    />
                  </label>
                  <label className="block">
                    <span className={MODAL_FIELD_LABEL_CLASS}>{t("ui.productQuickCreateUnit")}</span>
                    <select
                      value={qcUnitCode}
                      onChange={(e) => setQcUnitCode(e.target.value)}
                      className={MODAL_INPUT_CLASS}
                    >
                      <option value="">{t("ui.productQuickCreateUnitPh")}</option>
                      {uoms.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.nameRu} ({u.code})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setQuickOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="button" variant="primary" disabled={qcBusy} onClick={() => void submitQuickCreate()}>
                    {t("common.save")}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
