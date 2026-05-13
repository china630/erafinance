"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
} from "../../lib/design-system";
import { Button } from "../ui/button";

type DepreciationMethod =
  | "STRAIGHT_LINE"
  | "REDUCING_BALANCE"
  | "UNITS_OF_PRODUCTION";

function decToInput(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "toString" in v) {
    return String((v as { toString(): string }).toString());
  }
  return String(v);
}

export function FixedAssetModal({
  open,
  mode,
  assetId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  assetId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [invNo, setInvNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [life, setLife] = useState("60");
  const [salvage, setSalvage] = useState("0");
  const [depreciationMethod, setDepreciationMethod] =
    useState<DepreciationMethod>("STRAIGHT_LINE");
  const [totalExpectedUnits, setTotalExpectedUnits] = useState("");
  const [decliningBalanceRate, setDecliningBalanceRate] = useState("");
  const [usageUnits, setUsageUnits] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    if (mode === "create") {
      setName("");
      setInvNo("");
      setPurchaseDate("");
      setPurchasePrice("");
      setLife("60");
      setSalvage("0");
      setDepreciationMethod("STRAIGHT_LINE");
      setTotalExpectedUnits("");
      setDecliningBalanceRate("");
      setUsageUnits("");
      setLoading(false);
      return;
    }
    if (!assetId) return;
    let cancelled = false;
    setLoading(true);
    void apiFetch(`/api/fixed-assets/${encodeURIComponent(assetId)}`).then(async (res) => {
      if (!res.ok) {
        toast.error(t("fixedAssets.loadErr"), { description: await res.text() });
        if (!cancelled) setLoading(false);
        return;
      }
      const row = (await res.json()) as {
        name: string;
        inventoryNumber: string;
        purchaseDate: string;
        purchasePrice: unknown;
        usefulLifeMonths: number;
        salvageValue: unknown;
        depreciationMethod?: DepreciationMethod;
        totalExpectedUnits?: unknown;
        decliningBalanceRate?: unknown;
      };
      if (cancelled) return;
      setName(row.name);
      setInvNo(row.inventoryNumber);
      setPurchaseDate(String(row.purchaseDate).slice(0, 10));
      setPurchasePrice(decToInput(row.purchasePrice));
      setLife(String(row.usefulLifeMonths));
      setSalvage(decToInput(row.salvageValue));
      setDepreciationMethod(row.depreciationMethod ?? "STRAIGHT_LINE");
      setTotalExpectedUnits(decToInput(row.totalExpectedUnits));
      setDecliningBalanceRate(decToInput(row.decliningBalanceRate));
      setUsageUnits("");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, assetId, t]);

  function buildDepreciationPayload() {
    const base: Record<string, unknown> = {
      depreciationMethod,
    };
    if (depreciationMethod === "UNITS_OF_PRODUCTION") {
      const te = Number(totalExpectedUnits);
      if (!Number.isFinite(te) || te <= 0) return null;
      base.totalExpectedUnits = te;
    }
    if (depreciationMethod === "REDUCING_BALANCE") {
      const r = Number(decliningBalanceRate);
      if (!Number.isFinite(r) || r <= 0 || r > 1) return null;
      base.decliningBalanceRate = r;
    }
    return base;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || loading) return;
    if (!name.trim() || !invNo.trim() || !purchaseDate) {
      toast.error(t("common.fillRequired"));
      return;
    }
    const pp = Number(purchasePrice);
    if (!Number.isFinite(pp)) {
      toast.error(t("common.fillRequired"));
      return;
    }
    const lifeN = Number(life);
    if (!Number.isFinite(lifeN) || lifeN < 1) {
      toast.error(t("common.fillRequired"));
      return;
    }
    const depPayload = buildDepreciationPayload();
    if (!depPayload) {
      toast.error(t("common.fillRequired"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        const res = await apiFetch("/api/fixed-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            inventoryNumber: invNo.trim(),
            purchaseDate,
            purchasePrice: pp,
            usefulLifeMonths: lifeN,
            salvageValue: Number(salvage || 0),
            ...depPayload,
          }),
        });
        if (!res.ok) {
          toast.error(t("common.saveErr"), { description: await res.text() });
          return;
        }
        toast.success(t("common.save"));
        onSaved();
        onClose();
        return;
      }
      if (!assetId) return;
      const res = await apiFetch(`/api/fixed-assets/${encodeURIComponent(assetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          inventoryNumber: invNo.trim(),
          purchaseDate,
          purchasePrice: pp,
          usefulLifeMonths: lifeN,
          salvageValue: Number(salvage || 0),
          ...depPayload,
        }),
      });
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: await res.text() });
        return;
      }
      toast.success(t("common.save"));
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function submitUsage() {
    if (!assetId || busy) return;
    const u = Number(usageUnits);
    if (!Number.isFinite(u) || u <= 0) {
      toast.error(t("common.fillRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(
        `/api/fixed-assets/${encodeURIComponent(assetId)}/record-usage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodUnits: u }),
        },
      );
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: await res.text() });
        return;
      }
      toast.success(t("common.save"));
      setUsageUnits("");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const title = mode === "create" ? t("fixedAssets.newTitle") : t("employees.editSection");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`} role="dialog" aria-modal="true">
        <header className="flex shrink-0 items-start justify-between gap-3">
          <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">{title}</h3>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </header>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
          ) : (
            <form id="fixed-asset-modal-form" className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("fixedAssets.name")}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("fixedAssets.invNo")}
                <input
                  value={invNo}
                  onChange={(e) => setInvNo(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("fixedAssets.commission")}
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("fixedAssets.initial")}
                <input
                  type="number"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("fixedAssets.life")}
                <input
                  type="number"
                  min={1}
                  value={life}
                  onChange={(e) => setLife(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("fixedAssets.salvage")}
                <input
                  type="number"
                  step="0.01"
                  value={salvage}
                  onChange={(e) => setSalvage(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("fixedAssets.depreciationMethod")}
                <select
                  value={depreciationMethod}
                  onChange={(e) =>
                    setDepreciationMethod(e.target.value as DepreciationMethod)
                  }
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                >
                  <option value="STRAIGHT_LINE">
                    {t("fixedAssets.method.STRAIGHT_LINE")}
                  </option>
                  <option value="REDUCING_BALANCE">
                    {t("fixedAssets.method.REDUCING_BALANCE")}
                  </option>
                  <option value="UNITS_OF_PRODUCTION">
                    {t("fixedAssets.method.UNITS_OF_PRODUCTION")}
                  </option>
                </select>
              </label>
              {depreciationMethod === "REDUCING_BALANCE" ? (
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("fixedAssets.decliningBalanceRate")}
                  <input
                    type="number"
                    step="0.0001"
                    min={0.0001}
                    max={1}
                    value={decliningBalanceRate}
                    onChange={(e) => setDecliningBalanceRate(e.target.value)}
                    className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                  />
                </label>
              ) : null}
              {depreciationMethod === "UNITS_OF_PRODUCTION" ? (
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("fixedAssets.totalExpectedUnits")}
                  <input
                    type="number"
                    step="0.0001"
                    min={0.0001}
                    value={totalExpectedUnits}
                    onChange={(e) => setTotalExpectedUnits(e.target.value)}
                    className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                  />
                </label>
              ) : null}
              {mode === "edit" && depreciationMethod === "UNITS_OF_PRODUCTION" && assetId ? (
                <div className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-3 space-y-2">
                  <div className="text-sm font-semibold text-[#34495E]">
                    {t("fixedAssets.recordUsageTitle")}
                  </div>
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("fixedAssets.periodUnits")}
                    <input
                      type="number"
                      step="0.0001"
                      min={0.0001}
                      value={usageUnits}
                      onChange={(e) => setUsageUnits(e.target.value)}
                      className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className={MODAL_FOOTER_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void submitUsage()}
                  >
                    {t("fixedAssets.recordUsageSubmit")}
                  </Button>
                </div>
              ) : null}
            </form>
          )}
        </div>

        {!loading ? (
          <div className={MODAL_FOOTER_ACTIONS_CLASS}>
            <Button
              type="button"
              variant="outline"
              className={MODAL_FOOTER_BUTTON_CLASS}
              onClick={onClose}
              disabled={busy}
            >
              {t("common.close")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className={MODAL_FOOTER_BUTTON_CLASS}
              form="fixed-asset-modal-form"
              disabled={busy}
            >
              {busy ? "…" : t("fixedAssets.save")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
