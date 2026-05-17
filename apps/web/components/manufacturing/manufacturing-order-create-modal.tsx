"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
} from "../../lib/design-system";
import { FORM_LABEL_CLASS } from "../../lib/form-styles";
import { notifyListRefresh } from "../../lib/list-refresh-bus";
import { Button } from "../ui/button";

type RecipeOption = { id: string; name: string };
type Warehouse = { id: string; name: string };

export function ManufacturingOrderCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [recipeId, setRecipeId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);

  const loadMeta = useCallback(async () => {
    const [rr, wh] = await Promise.all([
      apiFetch("/api/manufacturing/recipes?page=1&pageSize=200"),
      apiFetch("/api/inventory/warehouses"),
    ]);
    if (rr.ok) {
      const data = (await rr.json()) as { items: RecipeOption[] };
      const list = data.items ?? [];
      setRecipes(list);
      setRecipeId((prev) => prev || list[0]?.id || "");
    }
    if (wh.ok) {
      const wlist = (await wh.json()) as Warehouse[];
      setWarehouses(wlist);
      setWarehouseId((prev) => prev || wlist[0]?.id || "");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadMeta();
  }, [open, loadMeta]);

  async function submit() {
    const q = Number(quantity);
    if (!recipeId || !warehouseId || !Number.isFinite(q) || q <= 0) {
      toast.error(t("manufacturing.orderValidation"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/manufacturing/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId, warehouseId, quantity: q }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("manufacturing.orderCreated"));
    notifyListRefresh("manufacturing-orders");
    notifyListRefresh("manufacturing-dashboard");
    onCreated();
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        className={MODAL_DIALOG_CONTENT_CLASS}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D5DADF] px-5 py-4">
          <h2 className="m-0 text-lg font-semibold text-[#34495E]">
            {t("manufacturing.newOrder")}
          </h2>
          <button type="button" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className={FORM_LABEL_CLASS}>
            {t("manufacturing.recipeSelect")}
            <select
              className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className={FORM_LABEL_CLASS}>
            {t("manufacturing.warehouse")}
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
          <label className={FORM_LABEL_CLASS}>
            {t("manufacturing.targetQuantity")}
            <input
              type="number"
              min={0}
              step="any"
              className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        </div>
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button
            type="button"
            variant="outline"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={onClose}
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            className={MODAL_FOOTER_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "…" : t("manufacturing.orderCreateBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}
