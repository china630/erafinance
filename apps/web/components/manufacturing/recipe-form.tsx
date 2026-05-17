"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ProductCombobox, type ProductRow } from "../ui/product-combobox";
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "../../lib/form-styles";
import { apiFetch } from "../../lib/api-client";
import { MODAL_INPUT_CLASS } from "../../lib/design-system";
import { Button } from "../ui/button";

export type RecipeLineFormRow = {
  key: string;
  productId: string;
  productLabel: string;
  unitCode: string;
  quantityPerUnit: string;
  wasteFactor: string;
};

export type RecipeByproductFormRow = {
  key: string;
  productId: string;
  productLabel: string;
  unitCode: string;
  quantityPerUnit: string;
  costFactor: string;
};

type UnitRow = { code: string; nameAz: string; nameRu: string };

function newLineRow(): RecipeLineFormRow {
  return {
    key: crypto.randomUUID(),
    productId: "",
    productLabel: "",
    unitCode: "",
    quantityPerUnit: "1",
    wasteFactor: "0",
  };
}

function newByproductRow(): RecipeByproductFormRow {
  return {
    key: crypto.randomUUID(),
    productId: "",
    productLabel: "",
    unitCode: "",
    quantityPerUnit: "1",
    costFactor: "0",
  };
}

export type RecipeFormValues = {
  name: string;
  finishedProductId: string;
  finishedProductLabel: string;
  lines: RecipeLineFormRow[];
  byproducts: RecipeByproductFormRow[];
};

export function RecipeForm({
  value,
  onChange,
  disabled,
}: {
  value: RecipeFormValues;
  onChange: (v: RecipeFormValues) => void;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [uoms, setUoms] = useState<UnitRow[]>([]);
  const [showWaste, setShowWaste] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await apiFetch("/api/system/units-of-measure");
      if (!res.ok) return;
      const rows = (await res.json()) as UnitRow[];
      if (alive) setUoms(Array.isArray(rows) ? rows : []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const unitLabel = useCallback(
    (code: string) => {
      if (!code) return "—";
      const u = uoms.find((x) => x.code === code);
      if (!u) return code;
      return i18n.language.startsWith("az") ? u.nameAz : u.nameRu;
    },
    [i18n.language, uoms],
  );

  const patch = (partial: Partial<RecipeFormValues>) => onChange({ ...value, ...partial });

  const setLine = (key: string, row: RecipeLineFormRow) => {
    patch({ lines: value.lines.map((l) => (l.key === key ? row : l)) });
  };

  const setBy = (key: string, row: RecipeByproductFormRow) => {
    patch({ byproducts: value.byproducts.map((b) => (b.key === key ? row : b)) });
  };

  const onProductPick = (p: ProductRow | null, code?: string) =>
    p
      ? {
          unitCode: code ?? (p as ProductRow & { unitOfMeasureCode?: string }).unitOfMeasureCode ?? "",
        }
      : { unitCode: "" };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={FORM_LABEL_CLASS}>{t("manufacturing.recipeName")}</span>
          <input
            type="text"
            className={FORM_INPUT_CLASS}
            value={value.name}
            disabled={disabled}
            onChange={(e) => patch({ name: e.target.value })}
            maxLength={200}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={FORM_LABEL_CLASS}>{t("manufacturing.targetProduct")}</span>
          <ProductCombobox
            value={value.finishedProductId}
            selectedLabel={value.finishedProductLabel}
            isService={false}
            disabled={disabled}
            onChange={(id, item) =>
              patch({
                finishedProductId: id,
                finishedProductLabel: item ? `${item.name} (${item.sku})` : "",
                name: value.name.trim() ? value.name : item?.name ?? "",
              })
            }
          />
        </label>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold text-[#34495E]">
            {t("manufacturing.ingredients")}
          </h3>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => patch({ lines: [...value.lines, newLineRow()] })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("common.create")}
          </Button>
        </div>
        <div className="space-y-3">
          {value.lines.map((line) => (
            <div
              key={line.key}
              className="grid gap-2 rounded-lg border border-[#D5DADF] p-3 sm:grid-cols-[1fr_6rem_5rem_auto]"
            >
              <div className="min-w-0">
                <span className={`${FORM_LABEL_CLASS} sm:hidden`}>{t("manufacturing.lineItem")}</span>
                <ProductCombobox
                  value={line.productId}
                  selectedLabel={line.productLabel}
                  isService={false}
                  disabled={disabled}
                  onChange={(id, item) => {
                    const extra = onProductPick(item);
                    setLine(line.key, {
                      ...line,
                      productId: id,
                      productLabel: item ? `${item.name} (${item.sku})` : "",
                      unitCode: extra.unitCode,
                    });
                  }}
                />
              </div>
              <label className="block">
                <span className={FORM_LABEL_CLASS}>{t("manufacturing.qty")}</span>
                <input
                  type="number"
                  min={0.0001}
                  step="any"
                  className={MODAL_INPUT_CLASS}
                  disabled={disabled}
                  value={line.quantityPerUnit}
                  onChange={(e) => setLine(line.key, { ...line, quantityPerUnit: e.target.value })}
                />
              </label>
              <div>
                <span className={FORM_LABEL_CLASS}>{t("manufacturing.unit")}</span>
                <p className="mt-1 h-9 flex items-center text-[13px] text-[#7F8C8D]">
                  {unitLabel(line.unitCode)}
                </p>
              </div>
              <div className="flex items-end justify-end pb-0.5">
                <button
                  type="button"
                  className="rounded-lg p-2 text-[#7F8C8D] hover:bg-[#F4F5F7] disabled:opacity-50"
                  disabled={disabled || value.lines.length <= 1}
                  aria-label={t("common.delete")}
                  onClick={() => patch({ lines: value.lines.filter((l) => l.key !== line.key) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {showWaste && (
                <label className="block sm:col-span-3">
                  <span className={FORM_LABEL_CLASS}>{t("manufacturing.wasteFactor")}</span>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step="0.01"
                    className={MODAL_INPUT_CLASS}
                    disabled={disabled}
                    value={line.wasteFactor}
                    onChange={(e) => setLine(line.key, { ...line, wasteFactor: e.target.value })}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-xs text-[#2980B9] hover:underline"
          onClick={() => setShowWaste((v) => !v)}
        >
          {showWaste ? t("manufacturing.hideAdvanced") : t("manufacturing.showAdvanced")}
        </button>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold text-[#34495E]">
            {t("manufacturing.byproducts")}
          </h3>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => patch({ byproducts: [...value.byproducts, newByproductRow()] })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("common.create")}
          </Button>
        </div>
        {value.byproducts.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("manufacturing.byproductsEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {value.byproducts.map((row) => (
              <div
                key={row.key}
                className="grid gap-2 rounded-lg border border-[#D5DADF] p-3 sm:grid-cols-[1fr_6rem_5rem_auto]"
              >
                <ProductCombobox
                  value={row.productId}
                  selectedLabel={row.productLabel}
                  isService={false}
                  disabled={disabled}
                  onChange={(id, item) => {
                    const extra = onProductPick(item);
                    setBy(row.key, {
                      ...row,
                      productId: id,
                      productLabel: item ? `${item.name} (${item.sku})` : "",
                      unitCode: extra.unitCode,
                    });
                  }}
                />
                <label className="block">
                  <span className={FORM_LABEL_CLASS}>{t("manufacturing.qty")}</span>
                  <input
                    type="number"
                    min={0.0001}
                    step="any"
                    className={MODAL_INPUT_CLASS}
                    disabled={disabled}
                    value={row.quantityPerUnit}
                    onChange={(e) => setBy(row.key, { ...row, quantityPerUnit: e.target.value })}
                  />
                </label>
                <div>
                  <span className={FORM_LABEL_CLASS}>{t("manufacturing.unit")}</span>
                  <p className="mt-1 h-9 flex items-center text-[13px] text-[#7F8C8D]">
                    {unitLabel(row.unitCode)}
                  </p>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[#7F8C8D] hover:bg-[#F4F5F7]"
                    disabled={disabled}
                    aria-label={t("common.delete")}
                    onClick={() =>
                      patch({ byproducts: value.byproducts.filter((b) => b.key !== row.key) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function emptyRecipeFormValues(): RecipeFormValues {
  return {
    name: "",
    finishedProductId: "",
    finishedProductLabel: "",
    lines: [newLineRow()],
    byproducts: [],
  };
}
