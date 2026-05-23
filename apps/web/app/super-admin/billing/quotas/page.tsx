"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { EmptyState } from "../../../../components/empty-state";
import { apiFetch } from "../../../../lib/api-client";
import type {
  BillingPayload,
  TierKey,
} from "../../../../lib/super-admin/billing-types";
import {
  DEFAULT_METER_UNIT_PRICING,
  DEFAULT_TIER_SPEND_CEILINGS,
} from "../../../../lib/super-admin/spend-tier-defaults";
import { QUOTA_MATRIX_TIERS } from "../../../../lib/super-admin/quota-matrix";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../../../lib/design-system";
import { useBilling } from "../billing-context";

function parseMoney(s: string): number {
  return Number.parseFloat(s.trim().replace(",", "."));
}

function meterFromBilling(
  m: BillingPayload["meterUnitPricing"] | undefined,
): Record<keyof typeof DEFAULT_METER_UNIT_PRICING, string> {
  const src = m ?? DEFAULT_METER_UNIT_PRICING;
  return {
    pricePerUserMonthAzn: String(src.pricePerUserMonthAzn),
    pricePerGbMonthAzn: String(src.pricePerGbMonthAzn),
    pricePerWhatsappAlertAzn: String(src.pricePerWhatsappAlertAzn),
    pricePerInvoiceAzn: String(src.pricePerInvoiceAzn),
    pricePerOcrPageAzn: String(src.pricePerOcrPageAzn),
  };
}

function ceilingsFromBilling(
  c: BillingPayload["tierSpendCeilings"] | undefined,
): Record<TierKey, string> {
  const src = { ...DEFAULT_TIER_SPEND_CEILINGS, ...c };
  return {
    TIER_0: String(src.TIER_0),
    TIER_1: String(src.TIER_1),
    TIER_2: String(src.TIER_2),
    TIER_3: String(src.TIER_3),
  };
}

export default function SuperAdminBillingQuotasPage() {
  const { t } = useTranslation();
  const {
    billing,
    billingLoading,
    billingLoadError,
    billingLoadTimedOut,
    loadBilling,
    resetPricingCatalog,
  } = useBilling();

  const [saving, setSaving] = useState(false);
  const [yearlyDiscStr, setYearlyDiscStr] = useState("20");
  const [ocrJobsPerMonthStr, setOcrJobsPerMonthStr] = useState("200");
  const [meterStr, setMeterStr] = useState(meterFromBilling(undefined));
  const [ceilingStr, setCeilingStr] = useState(ceilingsFromBilling(undefined));

  useEffect(() => {
    if (!billing) return;
    setYearlyDiscStr(String(billing.yearlyDiscountPercent ?? 20));
    setOcrJobsPerMonthStr(String(billing.ocrJobsPerOrgMonth ?? 200));
    setMeterStr(meterFromBilling(billing.meterUnitPricing));
    setCeilingStr(ceilingsFromBilling(billing.tierSpendCeilings));
  }, [billing]);

  const saveAll = async () => {
    const y = parseMoney(yearlyDiscStr);
    if (!Number.isFinite(y) || y < 0 || y > 100) {
      toast.error(t("common.saveErr"), {
        description: t("superAdmin.billingInvalidYearlyDiscount"),
      });
      return;
    }
    const ocrN = Number.parseInt(ocrJobsPerMonthStr.trim().replace(/\s/g, ""), 10);
    if (!Number.isFinite(ocrN) || ocrN < 1) {
      toast.error(t("common.saveErr"), {
        description: t("superAdmin.billingInvalidOcrLimit"),
      });
      return;
    }
    const meter = {
      pricePerUserMonthAzn: parseMoney(meterStr.pricePerUserMonthAzn),
      pricePerGbMonthAzn: parseMoney(meterStr.pricePerGbMonthAzn),
      pricePerWhatsappAlertAzn: parseMoney(meterStr.pricePerWhatsappAlertAzn),
      pricePerInvoiceAzn: parseMoney(meterStr.pricePerInvoiceAzn),
      pricePerOcrPageAzn: parseMoney(meterStr.pricePerOcrPageAzn),
    };
    if (Object.values(meter).some((v) => !Number.isFinite(v) || v < 0)) {
      toast.error(t("common.saveErr"), {
        description: t("superAdmin.spendTierInvalidMeter"),
      });
      return;
    }
    const ceilings = {} as Record<TierKey, number>;
    for (const tier of QUOTA_MATRIX_TIERS) {
      const v = parseMoney(ceilingStr[tier]);
      if (!Number.isFinite(v) || v < 0) {
        toast.error(t("common.saveErr"), {
          description: t("superAdmin.spendTierInvalidCeiling"),
        });
        return;
      }
      ceilings[tier] = v;
    }

    setSaving(true);
    try {
      const [yRes, oRes, mRes, cRes] = await Promise.all([
        apiFetch("/api/admin/config/billing/yearly-discount", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ percent: y }),
        }),
        apiFetch("/api/admin/config/billing/ocr-jobs-per-org-month", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: ocrN }),
        }),
        apiFetch("/api/admin/config/billing/meter-unit-pricing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meter),
        }),
        apiFetch("/api/admin/config/billing/tier-spend-ceilings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ceilings),
        }),
      ]);
      if (!yRes.ok || !oRes.ok || !mRes.ok || !cRes.ok) {
        const status = [yRes, oRes, mRes, cRes]
          .filter((r) => !r.ok)
          .map((r) => r.status)
          .join(", ");
        toast.error(t("common.saveErr"), { description: `HTTP ${status}` });
        return;
      }
      toast.success(t("common.save"));
      await loadBilling();
    } finally {
      setSaving(false);
    }
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
        <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.billingFallbackHint")}</p>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void loadBilling()}>
          {t("superAdmin.billingRetryLoad")}
        </button>
      </div>
    );
  }

  if (!billing) return null;

  const meterFields = [
    ["pricePerUserMonthAzn", "meterUserMonth"],
    ["pricePerInvoiceAzn", "meterInvoiceMonth"],
    ["pricePerGbMonthAzn", "meterGbMonth"],
    ["pricePerWhatsappAlertAzn", "meterWhatsapp"],
    ["pricePerOcrPageAzn", "meterOcrPage"],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-[#D5DADF] bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
          {t("superAdmin.billingQuotasSectionsTitle")}
        </h2>
        <p className="m-0 text-[13px] text-[#7F8C8D]">
          {t("superAdmin.billingQuotasGlobalHint")}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("superAdmin.billingYearlyDiscountLabel")}
            <input
              className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
              inputMode="decimal"
              value={yearlyDiscStr}
              onChange={(e) => setYearlyDiscStr(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("superAdmin.billingOcrJobsLimit")}
            <input
              className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
              inputMode="numeric"
              value={ocrJobsPerMonthStr}
              onChange={(e) => setOcrJobsPerMonthStr(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#D5DADF] bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
          {t("superAdmin.tierQuotasTitle")}
        </h2>
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t("superAdmin.tierQuotasHint")}</p>

        <h3 className="m-0 pt-2 text-[12px] font-bold uppercase tracking-wide text-[#7F8C8D]">
          {t("superAdmin.spendTierUnitPricesTitle")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meterFields.map(([key, labelKey]) => (
            <label key={key} className="block text-[13px] text-[#34495E]">
              {t(`superAdmin.${labelKey}`)}
              <input
                className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
                inputMode="decimal"
                value={meterStr[key]}
                onChange={(e) =>
                  setMeterStr((s) => ({ ...s, [key]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>

        <h3 className="m-0 pt-2 text-[12px] font-bold uppercase tracking-wide text-[#7F8C8D]">
          {t("superAdmin.spendTierCeilingsTitle")}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUOTA_MATRIX_TIERS.map((tier) => (
            <label key={tier} className="block text-[13px] text-[#34495E]">
              {t("superAdmin.spendTierCeilingTier", { tier })}
              <input
                className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
                inputMode="decimal"
                value={ceilingStr[tier]}
                onChange={(e) =>
                  setCeilingStr((s) => ({ ...s, [tier]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={billingLoading || saving}
            onClick={() => void saveAll()}
          >
            {saving ? t("superAdmin.billingSaving") : t("superAdmin.billingSaveQuotasPage")}
          </button>
        </div>
      </div>
    </div>
  );
}
