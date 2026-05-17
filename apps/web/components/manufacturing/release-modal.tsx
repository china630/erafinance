"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TR_CLASS,
} from "../../lib/design-system";
import { FORM_LABEL_CLASS, FORM_INPUT_CLASS } from "../../lib/form-styles";
import { notifyListRefresh } from "../../lib/list-refresh-bus";
import { Button } from "../ui/button";

type RecipeOption = { id: string; name: string; finishedProduct?: { name: string } };
type Warehouse = { id: string; name: string };

type RecipeDetail = {
  id: string;
  name: string;
  lines: Array<{
    componentProductId: string;
    quantityPerUnit: string | number;
    wasteFactor?: string | number;
    component?: { name: string; sku: string };
  }>;
};

type AvailableOutput = {
  maxOutputUnits: string;
  bottlenecks: Array<{ componentName: string; needPerFgUnit: string; available: string }>;
};

function needQty(line: RecipeDetail["lines"][0], batchQty: number): number {
  const wf = Number(line.wasteFactor ?? 0);
  return Number(line.quantityPerUnit) * (1 + wf) * batchQty;
}

export function ReleaseModal({
  open,
  onClose,
  onReleased,
}: {
  open: boolean;
  onClose: () => void;
  onReleased: () => void;
}) {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [recipeId, setRecipeId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [targetQty, setTargetQty] = useState("1");
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [virtualOut, setVirtualOut] = useState<AvailableOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const batchQty = useMemo(() => {
    const q = Number(targetQty);
    return Number.isFinite(q) && q > 0 ? q : 0;
  }, [targetQty]);

  const materialRows = useMemo(() => {
    if (!detail || batchQty <= 0) return [];
    return detail.lines.map((l) => ({
      id: l.componentProductId,
      name: l.component?.name ?? l.componentProductId,
      perUnit: Number(l.quantityPerUnit) * (1 + Number(l.wasteFactor ?? 0)),
      total: needQty(l, batchQty),
    }));
  }, [detail, batchQty]);

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

  const loadRecipe = useCallback(async () => {
    if (!recipeId) {
      setDetail(null);
      return;
    }
    const res = await apiFetch(`/api/manufacturing/recipes/${recipeId}`);
    if (!res.ok) {
      setDetail(null);
      return;
    }
    setDetail((await res.json()) as RecipeDetail);
  }, [recipeId]);

  const loadVirtual = useCallback(async () => {
    if (!recipeId || !warehouseId) return;
    const res = await apiFetch(
      `/api/manufacturing/recipes/${recipeId}/available-output?warehouseId=${encodeURIComponent(warehouseId)}`,
    );
    if (!res.ok) {
      setVirtualOut(null);
      return;
    }
    setVirtualOut((await res.json()) as AvailableOutput);
  }, [recipeId, warehouseId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void loadMeta().finally(() => setLoading(false));
  }, [open, loadMeta]);

  useEffect(() => {
    if (!open || !recipeId) return;
    void loadRecipe();
  }, [open, recipeId, loadRecipe]);

  useEffect(() => {
    if (!open) return;
    void loadVirtual();
  }, [open, loadVirtual]);

  async function handleRelease() {
    if (!recipeId || !warehouseId || batchQty <= 0) {
      toast.error(t("manufacturing.releaseValidation"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/manufacturing/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId,
        warehouseId,
        quantity: batchQty,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("manufacturing.releaseSuccess"));
    notifyListRefresh("manufacturing-releases");
    notifyListRefresh("manufacturing-dashboard");
    onReleased();
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
            {t("manufacturing.newRelease")}
          </h2>
          <button type="button" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 py-4">
          {loading ? (
            <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={FORM_LABEL_CLASS}>{t("manufacturing.recipeSelect")}</span>
                  <select
                    className={FORM_INPUT_CLASS}
                    value={recipeId}
                    disabled={busy}
                    onChange={(e) => setRecipeId(e.target.value)}
                  >
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.finishedProduct ? ` — ${r.finishedProduct.name}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={FORM_LABEL_CLASS}>{t("manufacturing.warehouse")}</span>
                  <select
                    className={FORM_INPUT_CLASS}
                    value={warehouseId}
                    disabled={busy}
                    onChange={(e) => setWarehouseId(e.target.value)}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={FORM_LABEL_CLASS}>{t("manufacturing.targetQuantity")}</span>
                  <input
                    type="number"
                    min={0.0001}
                    step="any"
                    className={MODAL_INPUT_CLASS}
                    value={targetQty}
                    disabled={busy}
                    onChange={(e) => setTargetQty(e.target.value)}
                  />
                </label>
                {virtualOut && (
                  <div className="flex flex-col justify-end text-[13px] text-[#7F8C8D]">
                    <span>
                      {t("manufacturing.availableOutputMax")}:{" "}
                      <strong className="text-[#34495E]">{virtualOut.maxOutputUnits}</strong>
                    </span>
                    <button
                      type="button"
                      className="mt-1 self-start text-xs text-[#2980B9] hover:underline"
                      onClick={() => setTargetQty(virtualOut.maxOutputUnits)}
                    >
                      {t("manufacturing.availableOutputUseQty")}
                    </button>
                  </div>
                )}
              </div>

              {materialRows.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-[#34495E]">
                    {t("manufacturing.requiredMaterials")}
                  </h3>
                  <table className={`${DATA_TABLE_CLASS} min-w-full`}>
                    <thead>
                      <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.lineItem")}</th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.perUnitNeed")}</th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.totalNeed")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialRows.map((row) => (
                        <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                          <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                          <td className={DATA_TABLE_TD_CLASS}>{row.perUnit.toFixed(4)}</td>
                          <td className={DATA_TABLE_TD_CLASS}>{row.total.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
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
            onClick={() => void handleRelease()}
          >
            {t("manufacturing.releaseBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
