"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { EmptyState } from "../../../../components/empty-state";
import { apiFetch } from "../../../../lib/api-client";
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
  MODAL_INPUT_NUMERIC_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";
import { pricingModuleLabel } from "../../../../lib/pricing-module-label";
import { useBilling } from "../billing-context";

export default function SuperAdminBillingPricingPage() {
  const { t } = useTranslation();
  const {
    billing,
    billingLoading,
    billingLoadError,
    billingLoadTimedOut,
    loadBilling,
    resetPricingCatalog,
  } = useBilling();

  const [foundationStr, setFoundationStr] = useState("");
  const [modulePriceEdits, setModulePriceEdits] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    if (!billing) return;
    setFoundationStr(String(billing.foundationMonthlyAzn ?? ""));
    const mp: Record<string, string> = {};
    for (const m of billing.pricingModules ?? []) {
      mp[m.id] = String(m.pricePerMonth);
    }
    setModulePriceEdits(mp);
  }, [billing]);

  const saveAll = async () => {
    if (!billing) return;
    const n = Number.parseFloat(foundationStr.trim().replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast.error(t("common.saveErr"));
      return;
    }
    const modules = billing.pricingModules.map((mod) => {
      const raw = (modulePriceEdits[mod.id] ?? "").trim().replace(",", ".");
      const p = Number.parseFloat(raw);
      if (!Number.isFinite(p) || p < 0) {
        return null;
      }
      return { key: mod.key, pricePerMonth: p };
    });
    if (modules.some((m) => m === null)) {
      toast.error(t("common.saveErr"), {
        description: t("superAdmin.billingInvalidModulePrice"),
      });
      return;
    }
    const res = await apiFetch("/api/admin/config/billing/pricing-catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foundationMonthlyAzn: n,
        modules,
      }),
    });
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: `${res.status}` });
      return;
    }
    toast.success(t("common.save"));
    void loadBilling();
  };

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
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
          {t("superAdmin.billingFallbackTitle")}
        </h2>
        <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.billingFallbackHint")}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => void loadBilling()}
          >
            {t("superAdmin.billingRetryLoad")}
          </button>
        </div>
      </div>
    );
  }

  if (!billing) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-[#D5DADF] bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
          {t("superAdmin.billingFoundationTitle")}
        </h2>
        <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.billingFoundationHint")}</p>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("superAdmin.priceAzn")}
          <input
            className="mt-1.5 box-border h-9 w-full max-w-xs rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] text-[#34495E] placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
            value={foundationStr}
            onChange={(e) => setFoundationStr(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#D5DADF] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
            {t("superAdmin.billingModuleCatalogTitle")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void resetPricingCatalog()}
            >
              {t("superAdmin.billingResetPrice")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={billingLoading}
              onClick={() => void saveAll()}
            >
              {t("superAdmin.billingSave")}
            </button>
          </div>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("superAdmin.billingColModule")}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("superAdmin.billingColPrice")}
                </th>
              </tr>
            </thead>
            <tbody>
              {billing.pricingModules.map((mod) => (
                <tr key={mod.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[13px] font-semibold`}>
                    {pricingModuleLabel(mod.key, mod.name, t)}
                  </td>
                  <td className={`${DATA_TABLE_TD_RIGHT_CLASS} max-w-[10rem]`}>
                    <input
                      className={`${MODAL_INPUT_NUMERIC_CLASS} ml-auto box-border h-9 w-full max-w-[8rem] rounded-lg px-3 py-1.5 text-[13px]`}
                      value={modulePriceEdits[mod.id] ?? ""}
                      onChange={(e) =>
                        setModulePriceEdits((s) => ({
                          ...s,
                          [mod.id]: e.target.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
