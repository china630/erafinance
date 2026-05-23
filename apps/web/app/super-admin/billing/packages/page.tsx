"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Pencil, Trash2, X } from "lucide-react";
import { EmptyState } from "../../../../components/empty-state";
import { apiFetch } from "../../../../lib/api-client";
import { pricingModuleLabel } from "../../../../lib/pricing-module-label";
import { computeBundlePreview, moduleNamesFromKeys } from "../../../../lib/super-admin/billing-preview";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";
import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@erafinance/ui";
import { BundleSwitch } from "../../../../components/super-admin/billing/bundle-switch";
import { useBilling } from "../billing-context";

type BundleModalMode = "create" | "edit" | null;

export default function SuperAdminBillingPackagesPage() {
  const { t } = useTranslation();
  const {
    billing,
    billingLoading,
    billingLoadError,
    billingLoadTimedOut,
    loadBilling,
    resetPricingCatalog,
  } = useBilling();

  const [modalMode, setModalMode] = useState<BundleModalMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [bundleName, setBundleName] = useState("");
  const [bundleDisc, setBundleDisc] = useState("0");
  const [bundleMods, setBundleMods] = useState<Record<string, boolean>>({});
  const [trialDefault, setTrialDefault] = useState(false);

  useEffect(() => {
    if (!billing?.pricingModules) return;
    setBundleMods((prev) => {
      const next = { ...prev };
      for (const m of billing.pricingModules) {
        if (next[m.key] === undefined) next[m.key] = false;
      }
      return next;
    });
  }, [billing]);

  const openCreate = () => {
    if (!billing) return;
    setModalMode("create");
    setEditId(null);
    setBundleName("");
    setBundleDisc("0");
    const o: Record<string, boolean> = {};
    for (const m of billing.pricingModules) o[m.key] = false;
    setBundleMods(o);
    setTrialDefault(false);
  };

  const openEdit = (id: string) => {
    if (!billing) return;
    const b = billing.pricingBundles.find((x) => x.id === id);
    if (!b) return;
    setModalMode("edit");
    setEditId(id);
    setBundleName(b.name);
    setBundleDisc(String(b.discountPercent));
    const o: Record<string, boolean> = {};
    for (const m of billing.pricingModules) {
      o[m.key] = b.moduleKeys.includes(m.key);
    }
    setBundleMods(o);
    setTrialDefault(Boolean(b.isTrialDefault));
  };

  /** Spend-tier: trial length is fixed in platform code (3 Baku calendar months). */
  const buildTrialPayload = () => ({
    isTrialDefault: trialDefault,
    trialDurationDays: null,
    trialQuotas: null,
  });

  const saveBundle = async () => {
    if (!billing) return;
    const name = bundleName.trim();
    if (!name) {
      toast.error(t("common.fillRequired"));
      return;
    }
    const disc = Number.parseFloat(bundleDisc);
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
      toast.error(t("common.saveErr"));
      return;
    }
    const moduleKeys = Object.entries(bundleMods)
      .filter(([, on]) => on)
      .map(([k]) => k);
    const trial = buildTrialPayload();

    if (modalMode === "create") {
      const res = await apiFetch("/api/admin/pricing-bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          discountPercent: disc,
          moduleKeys,
          trial,
        }),
      });
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: `${res.status}` });
        return;
      }
      toast.success(t("common.save"));
      setModalMode(null);
      void loadBilling();
      return;
    }

    if (modalMode === "edit" && editId) {
      const res = await apiFetch(`/api/admin/pricing-bundles/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          discountPercent: disc,
          moduleKeys,
          trial,
        }),
      });
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: `${res.status}` });
        return;
      }
      toast.success(t("common.save"));
      setModalMode(null);
      void loadBilling();
    }
  };

  const onDialogOpenChange = useCallback((next: boolean) => {
    if (!next) setModalMode(null);
  }, []);

  const preview = useMemo(() => {
    if (!billing) return null;
    const disc = Number.parseFloat(bundleDisc);
    const keys = Object.entries(bundleMods)
      .filter(([, on]) => on)
      .map(([k]) => k);
    return computeBundlePreview(
      billing.foundationMonthlyAzn,
      billing.pricingModules,
      keys,
      Number.isFinite(disc) ? disc : 0,
      billing.yearlyDiscountPercent,
    );
  }, [billing, bundleDisc, bundleMods]);

  if (billingLoadError && !billing) {
    return (
      <EmptyState
        title={t("superAdmin.billingLoadFailed")}
        description={billingLoadError}
        className="!border-solid"
        action={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void resetPricingCatalog()}
          >
            {t("superAdmin.billingResetPrice")}
          </button>
        }
      />
    );
  }

  if (!billing && !billingLoadError && !billingLoadTimedOut) {
    return (
      <p className="text-center text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
    );
  }

  if (!billing && (billingLoadTimedOut || billingLoadError)) {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.billingFallbackHint")}</p>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void loadBilling()}>
          {t("superAdmin.billingRetryLoad")}
        </button>
      </div>
    );
  }

  if (!billing) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
          {t("superAdmin.billingBundlesList")}
        </h2>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
          {t("superAdmin.billingNewPackage")}
        </button>
      </div>

      {billing.pricingBundles.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.billingBundlesEmpty")}</p>
      ) : (
        <ul className="space-y-4">
          {billing.pricingBundles.map((b) => {
            const p = computeBundlePreview(
              billing.foundationMonthlyAzn,
              billing.pricingModules,
              b.moduleKeys,
              b.discountPercent,
              billing.yearlyDiscountPercent,
            );
            const trialClass = b.isTrialDefault
              ? "border-[#2980B9] ring-2 ring-[#2980B9]/25"
              : "border-[#D5DADF]";
            return (
              <li
                key={b.id}
                className={`flex flex-col gap-3 rounded-2xl border bg-white p-5 ${trialClass}`}
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#34495E]">
                      {b.name}
                      {b.isTrialDefault ? (
                        <span className="rounded-md border border-[#2980B9] bg-[#EBEDF0] px-2 py-0.5 text-xs font-medium text-[#2980B9]">
                          {t("superAdmin.trialDefaultBadge")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[13px] text-[#7F8C8D]">
                      −{b.discountPercent}% ·{" "}
                      {moduleNamesFromKeys(b.moduleKeys, billing.pricingModules, t)}
                    </div>
                    <div className="mt-2 text-[13px] tabular-nums text-[#34495E]">
                      {t("superAdmin.billingPreviewMonthly")}: {p.monthly.toFixed(2)} AZN ·{" "}
                      {t("superAdmin.billingPreviewYearly")}: {p.yearly.toFixed(2)} AZN
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 self-start">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[13px] text-[#2980B9] hover:underline"
                      onClick={() => openEdit(b.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      {t("superAdmin.billingBundleEdit")}
                    </button>
                    <button
                      type="button"
                      className="text-[13px] text-red-600 hover:underline"
                      onClick={async () => {
                        const res = await apiFetch(`/api/admin/pricing-bundles/${b.id}`, {
                          method: "DELETE",
                        });
                        if (!res.ok) {
                          toast.error(t("common.saveErr"), { description: `${res.status}` });
                          return;
                        }
                        toast.success(t("common.save"));
                        void loadBilling();
                      }}
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={modalMode !== null} onOpenChange={onDialogOpenChange}>
        <DialogContent className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-2xl`}>
          <DialogHeader className="shrink-0">
            <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
              {modalMode === "create"
                ? t("superAdmin.billingNewPackage")
                : t("superAdmin.billingBundleEdit")}
            </h3>
            <Button
              type="button"
              variant="ghost"
              className={MODAL_CLOSE_BUTTON_CLASS}
              aria-label={t("common.close")}
              onClick={() => setModalMode(null)}
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
            </Button>
          </DialogHeader>
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 max-h-[min(70vh,32rem)] flex-1 space-y-4 overflow-y-auto pr-1">
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("superAdmin.billingBundleName")}
              <input
                className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("superAdmin.billingBundleDiscount")}
              <input
                className={`mt-1 block w-full max-w-xs ${MODAL_INPUT_NUMERIC_CLASS}`}
                value={bundleDisc}
                onChange={(e) => setBundleDisc(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-[#34495E]">
                {t("superAdmin.billingModulesInBundle")}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {billing.pricingModules.map((mod) => (
                  <div
                    key={mod.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#EBEDF0] bg-[#F8F9FA] px-3 py-2"
                  >
                    <div className="min-w-0 text-[13px] font-medium text-[#34495E]">
                      {pricingModuleLabel(mod.key, mod.name, t)}
                    </div>
                    <BundleSwitch
                      checked={Boolean(bundleMods[mod.key])}
                      onChange={(v) =>
                        setBundleMods((s) => ({
                          ...s,
                          [mod.key]: v,
                        }))
                      }
                      aria-label={pricingModuleLabel(mod.key, mod.name, t)}
                    />
                  </div>
                ))}
              </div>
            </div>
            {preview ? (
              <div className="rounded-2xl border border-[#D5DADF] bg-[#F8F9FA] p-4">
                <div className="mb-2 text-xs font-bold uppercase text-[#34495E]">
                  {t("superAdmin.billingPreviewTitle")}
                </div>
                <dl className="grid grid-cols-1 gap-2 text-[13px] text-[#34495E] sm:grid-cols-2">
                  <div>
                    <dt className="text-[#7F8C8D]">{t("superAdmin.billingPreviewSubtotal")}</dt>
                    <dd className="font-semibold tabular-nums">{preview.subtotal.toFixed(2)} AZN</dd>
                  </div>
                  <div>
                    <dt className="text-[#7F8C8D]">{t("superAdmin.billingAfterBundle")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {preview.afterBundle.toFixed(2)} AZN / {t("superAdmin.billingPerMonth")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#7F8C8D]">{t("superAdmin.billingPreviewYearly")}</dt>
                    <dd className="font-semibold tabular-nums">{preview.yearly.toFixed(2)} AZN</dd>
                  </div>
                </dl>
              </div>
            ) : null}
            <div className="rounded-2xl border border-[#D5DADF] bg-white p-4">
              <h4 className="text-sm font-semibold text-[#34495E]">{t("superAdmin.trialEditorTitle")}</h4>
              <p className="mt-1 text-[13px] text-[#7F8C8D]">{t("superAdmin.trialEditorHint")}</p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] text-[#34495E]">
                <input
                  type="checkbox"
                  className={`mt-0.5 ${MODAL_CHECKBOX_CLASS}`}
                  checked={trialDefault}
                  onChange={(e) => setTrialDefault(e.target.checked)}
                />
                <span>{t("superAdmin.trialIsDefault")}</span>
              </label>
              <p className="mt-2 text-[13px] leading-relaxed text-[#34495E]">
                {t("superAdmin.trialEditorSpendTierNote")}
              </p>
            </div>
            </div>
            <div className={`${MODAL_FOOTER_ACTIONS_CLASS} shrink-0`}>
            <Button variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => setModalMode(null)}>
              {t("common.close")}
            </Button>
            <Button variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => void saveBundle()}>
              {t("superAdmin.billingSave")}
            </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
