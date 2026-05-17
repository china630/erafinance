"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
} from "../../lib/design-system";
import { notifyListRefresh } from "../../lib/list-refresh-bus";
import { Button } from "../ui/button";
import {
  RecipeForm,
  emptyRecipeFormValues,
  type RecipeFormValues,
} from "./recipe-form";

type RecipeDetail = {
  id: string;
  name: string;
  finishedProductId: string;
  finishedProduct?: { id: string; name: string; sku: string };
  lines: Array<{
    componentProductId: string;
    quantityPerUnit: string | number;
    wasteFactor?: string | number;
    component?: { name: string; sku: string; unitOfMeasureCode?: string | null };
  }>;
  byproducts: Array<{
    productId: string;
    quantityPerUnit: string | number;
    costFactor?: string | number;
    product?: { name: string; sku: string; unitOfMeasureCode?: string | null };
  }>;
};

function mapDetailToForm(d: RecipeDetail): RecipeFormValues {
  const fp = d.finishedProduct;
  return {
    name: d.name,
    finishedProductId: d.finishedProductId,
    finishedProductLabel: fp ? `${fp.name} (${fp.sku})` : "",
    lines: d.lines.map((l) => ({
      key: crypto.randomUUID(),
      productId: l.componentProductId,
      productLabel: l.component ? `${l.component.name} (${l.component.sku})` : "",
      unitCode: l.component?.unitOfMeasureCode ?? "",
      quantityPerUnit: String(l.quantityPerUnit),
      wasteFactor: String(l.wasteFactor ?? 0),
    })),
    byproducts: d.byproducts.map((b) => ({
      key: crypto.randomUUID(),
      productId: b.productId,
      productLabel: b.product ? `${b.product.name} (${b.product.sku})` : "",
      unitCode: b.product?.unitOfMeasureCode ?? "",
      quantityPerUnit: String(b.quantityPerUnit),
      costFactor: String(b.costFactor ?? 0),
    })),
  };
}

export function RecipeModal({
  open,
  recipeId,
  onClose,
  onSaved,
}: {
  open: boolean;
  recipeId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<RecipeFormValues>(emptyRecipeFormValues);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!recipeId) {
      setForm(emptyRecipeFormValues());
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const res = await apiFetch(`/api/manufacturing/recipes/${recipeId}`);
        if (!res.ok) {
          toast.error(t("manufacturing.loadErr"));
          onClose();
          return;
        }
        const data = (await res.json()) as RecipeDetail;
        setForm(mapDetailToForm(data));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, recipeId, onClose, t]);

  async function handleSave() {
    if (!form.name.trim() || !form.finishedProductId) {
      toast.error(t("manufacturing.recipeValidation"));
      return;
    }
    const lines = form.lines.filter((l) => l.productId);
    if (lines.length === 0) {
      toast.error(t("manufacturing.recipeLinesRequired"));
      return;
    }
    for (const l of lines) {
      const q = Number(l.quantityPerUnit);
      if (!Number.isFinite(q) || q <= 0) {
        toast.error(t("manufacturing.recipeValidation"));
        return;
      }
    }
    setBusy(true);
    const body = {
      name: form.name.trim(),
      finishedProductId: form.finishedProductId,
      lines: lines.map((l) => ({
        componentProductId: l.productId,
        quantityPerUnit: Number(l.quantityPerUnit),
        wasteFactor: Number(l.wasteFactor) || 0,
      })),
      byproducts: form.byproducts
        .filter((b) => b.productId)
        .map((b) => ({
          productId: b.productId,
          quantityPerUnit: Number(b.quantityPerUnit),
          costFactor: Number(b.costFactor) || 0,
        })),
    };
    const res = await apiFetch("/api/manufacturing/recipes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("common.save"));
    notifyListRefresh("manufacturing-recipes");
    notifyListRefresh("manufacturing-dashboard");
    onSaved();
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-2xl w-full`}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D5DADF] pb-4">
          <h2 className="m-0 text-lg font-semibold text-[#34495E]">
            {recipeId ? t("manufacturing.editRecipe") : t("manufacturing.newRecipe")}
          </h2>
          <button type="button" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {loading ? (
            <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
          ) : (
            <RecipeForm value={form} onChange={setForm} disabled={busy} />
          )}
        </div>
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <button
            type="button"
            className={MODAL_FOOTER_BUTTON_CLASS}
            disabled={busy || loading}
            onClick={() => void handleSave()}
          >
            {t("manufacturing.saveRecipe")}
          </button>
        </div>
      </div>
    </div>
  );
}
