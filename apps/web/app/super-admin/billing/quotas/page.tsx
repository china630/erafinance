"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import { EmptyState } from "../../../../components/empty-state";
import { apiFetch } from "../../../../lib/api-client";
import type { TierKey } from "../../../../lib/super-admin/billing-types";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";
import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@erafinance/ui";
import { useBilling } from "../billing-context";

const TIERS: TierKey[] = ["STARTER", "BUSINESS", "ENTERPRISE"];

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

  const [yearlyDiscStr, setYearlyDiscStr] = useState("");
  const [ocrJobsPerMonthStr, setOcrJobsPerMonthStr] = useState("");
  const [quotaStr, setQuotaStr] = useState({
    employeeBlockSize: "",
    pricePerEmployeeBlockAzn: "",
    documentPackSize: "",
    pricePerDocumentPackAzn: "",
  });
  const [tierBillingPriceStr, setTierBillingPriceStr] = useState<
    Record<TierKey, string>
  >({
    STARTER: "",
    BUSINESS: "",
    ENTERPRISE: "",
  });
  const [tierQuotaDraft, setTierQuotaDraft] = useState<
    Record<
      TierKey,
      { maxEmployees: string; maxInvoicesPerMonth: string; maxStorageGb: string }
    >
  >({
    STARTER: { maxEmployees: "", maxInvoicesPerMonth: "", maxStorageGb: "" },
    BUSINESS: { maxEmployees: "", maxInvoicesPerMonth: "", maxStorageGb: "" },
    ENTERPRISE: { maxEmployees: "", maxInvoicesPerMonth: "", maxStorageGb: "" },
  });

  const [editTier, setEditTier] = useState<TierKey | null>(null);
  const [modalTierPrice, setModalTierPrice] = useState("");
  const [modalQuotas, setModalQuotas] = useState({
    maxEmployees: "",
    maxInvoicesPerMonth: "",
    maxStorageGb: "",
  });

  useEffect(() => {
    if (!billing) return;
    setYearlyDiscStr(String(billing.yearlyDiscountPercent ?? ""));
    setOcrJobsPerMonthStr(String(billing.ocrJobsPerOrgMonth ?? ""));
    const qp = billing.quotaPricing;
    setQuotaStr({
      employeeBlockSize: String(qp?.employeeBlockSize ?? ""),
      pricePerEmployeeBlockAzn: String(qp?.pricePerEmployeeBlockAzn ?? ""),
      documentPackSize: String(qp?.documentPackSize ?? ""),
      pricePerDocumentPackAzn: String(qp?.pricePerDocumentPackAzn ?? ""),
    });
    const prices = billing.prices ?? {};
    setTierBillingPriceStr({
      STARTER: String(prices.STARTER ?? ""),
      BUSINESS: String(prices.BUSINESS ?? ""),
      ENTERPRISE: String(prices.ENTERPRISE ?? ""),
    });
    const rawQuotas = billing.quotas as Record<string, Record<string, unknown>>;
    const tq = {
      STARTER: { maxEmployees: "", maxInvoicesPerMonth: "", maxStorageGb: "" },
      BUSINESS: { maxEmployees: "", maxInvoicesPerMonth: "", maxStorageGb: "" },
      ENTERPRISE: { maxEmployees: "", maxInvoicesPerMonth: "", maxStorageGb: "" },
    };
    for (const tier of TIERS) {
      const q = rawQuotas?.[tier] ?? {};
      tq[tier] = {
        maxEmployees: String(q.maxEmployees ?? ""),
        maxInvoicesPerMonth: String(q.maxInvoicesPerMonth ?? ""),
        maxStorageGb: String(q.maxStorageGb ?? ""),
      };
    }
    setTierQuotaDraft(tq);
  }, [billing]);

  const openTierModal = (tier: TierKey) => {
    setEditTier(tier);
    setModalTierPrice(tierBillingPriceStr[tier]);
    setModalQuotas({ ...tierQuotaDraft[tier] });
  };

  const saveGlobalLimits = async () => {
    const y = Number.parseFloat(yearlyDiscStr.trim().replace(",", "."));
    if (!Number.isFinite(y) || y < 0 || y > 100) {
      toast.error(t("common.saveErr"), {
        description: t("superAdmin.billingInvalidYearlyDiscount"),
      });
      return;
    }
    const parseMoney = (s: string) => Number.parseFloat(s.trim().replace(",", "."));
    const tierPrices = {} as Record<TierKey, number>;
    for (const tier of TIERS) {
      const p = parseMoney(tierBillingPriceStr[tier]);
      if (!Number.isFinite(p) || p < 0.01) {
        toast.error(t("common.saveErr"), {
          description: t("superAdmin.billingInvalidTierPrice", { tier }),
        });
        return;
      }
      tierPrices[tier] = p;
    }
    const ocrN = Number.parseInt(ocrJobsPerMonthStr.trim().replace(/\s/g, ""), 10);
    if (!Number.isFinite(ocrN) || ocrN < 1) {
      toast.error(t("common.saveErr"), {
        description: t("superAdmin.billingInvalidOcrLimit"),
      });
      return;
    }
    const patch = {
      employeeBlockSize: Number.parseInt(quotaStr.employeeBlockSize.trim(), 10),
      pricePerEmployeeBlockAzn: parseMoney(quotaStr.pricePerEmployeeBlockAzn),
      documentPackSize: Number.parseInt(quotaStr.documentPackSize.trim(), 10),
      pricePerDocumentPackAzn: parseMoney(quotaStr.pricePerDocumentPackAzn),
    };
    if (
      !Number.isFinite(patch.employeeBlockSize) ||
      !Number.isFinite(patch.pricePerEmployeeBlockAzn) ||
      !Number.isFinite(patch.documentPackSize) ||
      !Number.isFinite(patch.pricePerDocumentPackAzn)
    ) {
      toast.error(t("common.saveErr"));
      return;
    }
    const res = await apiFetch("/api/admin/config/billing/global-limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yearlyDiscountPercent: y,
        ocrJobsPerOrgMonth: ocrN,
        quotaPricing: patch,
        tierPrices,
      }),
    });
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: `${res.status}` });
      return;
    }
    toast.success(t("common.save"));
    void loadBilling();
  };

  const saveTierModal = async () => {
    if (!editTier) return;
    const parseTierQuotaInt = (s: string): number | null | undefined => {
      const x = s.trim();
      if (x === "") return null;
      const v = Number.parseInt(x, 10);
      if (!Number.isFinite(v) || v < 0) return undefined;
      return v;
    };
    const maxEmployees = parseTierQuotaInt(modalQuotas.maxEmployees);
    const maxInvoicesPerMonth = parseTierQuotaInt(modalQuotas.maxInvoicesPerMonth);
    const maxStorageGb = parseTierQuotaInt(modalQuotas.maxStorageGb);
    if (
      maxEmployees === undefined ||
      maxInvoicesPerMonth === undefined ||
      maxStorageGb === undefined
    ) {
      toast.error(t("common.fillRequired"));
      return;
    }
    const p = Number.parseFloat(modalTierPrice.trim().replace(",", "."));
    if (!Number.isFinite(p) || p < 0.01) {
      toast.error(t("common.saveErr"));
      return;
    }
    const pRes = await apiFetch("/api/admin/config/billing/price", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: editTier, amountAzn: p }),
    });
    if (!pRes.ok) {
      toast.error(t("common.saveErr"), { description: `${pRes.status}` });
      return;
    }
    const qRes = await apiFetch("/api/admin/config/billing/quotas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: editTier,
        quotas: { maxEmployees, maxInvoicesPerMonth, maxStorageGb },
      }),
    });
    if (!qRes.ok) {
      toast.error(t("common.saveErr"), { description: `${qRes.status}` });
      return;
    }
    toast.success(t("common.save"));
    setEditTier(null);
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
      <div className="space-y-4 rounded-2xl border border-[#D5DADF] bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
          {t("superAdmin.billingQuotasSectionsTitle")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <label key={tier} className="block text-[13px] font-medium text-[#34495E]">
              {tier}
              <input
                className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
                inputMode="decimal"
                value={tierBillingPriceStr[tier]}
                onChange={(e) =>
                  setTierBillingPriceStr((s) => ({ ...s, [tier]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("superAdmin.billingOcrJobsLimit")}
          <input
            className="mt-1.5 box-border h-9 w-full max-w-xs rounded-lg border border-[#D5DADF] px-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
            inputMode="numeric"
            value={ocrJobsPerMonthStr}
            onChange={(e) => setOcrJobsPerMonthStr(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-[13px] text-[#34495E]">
            {t("superAdmin.billingQuotaEmployeeBlock")}
            <input
              className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
              value={quotaStr.employeeBlockSize}
              onChange={(e) =>
                setQuotaStr((s) => ({ ...s, employeeBlockSize: e.target.value }))
              }
            />
          </label>
          <label className="block text-[13px] text-[#34495E]">
            {t("superAdmin.billingQuotaEmployeePrice")}
            <input
              className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
              value={quotaStr.pricePerEmployeeBlockAzn}
              onChange={(e) =>
                setQuotaStr((s) => ({
                  ...s,
                  pricePerEmployeeBlockAzn: e.target.value,
                }))
              }
            />
          </label>
          <label className="block text-[13px] text-[#34495E]">
            {t("superAdmin.billingQuotaDocBlock")}
            <input
              className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
              value={quotaStr.documentPackSize}
              onChange={(e) =>
                setQuotaStr((s) => ({ ...s, documentPackSize: e.target.value }))
              }
            />
          </label>
          <label className="block text-[13px] text-[#34495E]">
            {t("superAdmin.billingQuotaDocPrice")}
            <input
              className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
              value={quotaStr.pricePerDocumentPackAzn}
              onChange={(e) =>
                setQuotaStr((s) => ({
                  ...s,
                  pricePerDocumentPackAzn: e.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[200px] flex-1 text-[13px] text-[#34495E]">
            {t("superAdmin.billingYearlyDiscountLabel")}
            <input
              className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
              value={yearlyDiscStr}
              onChange={(e) => setYearlyDiscStr(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={billingLoading}
            onClick={() => void saveGlobalLimits()}
          >
            {t("superAdmin.billingSaveGlobalLimits")}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
          {t("superAdmin.tierQuotasTitle")}
        </h2>
        <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.tierQuotasHint")}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TIERS.map((tier) => {
            const d = tierQuotaDraft[tier];
            return (
              <div
                key={tier}
                className="flex flex-col rounded-2xl border border-[#D5DADF] bg-white p-5 shadow-sm"
              >
                <div className="text-[13px] font-bold text-[#34495E]">{tier}</div>
                <dl className="mt-3 space-y-2 text-[13px] text-[#34495E]">
                  <div>
                    <dt className="text-[#7F8C8D]">{t("superAdmin.tierQuotaFieldEmployees")}</dt>
                    <dd className="font-medium tabular-nums">{d.maxEmployees || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#7F8C8D]">
                      {t("superAdmin.tierQuotaFieldInvoicesMonthShort")}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {d.maxInvoicesPerMonth || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#7F8C8D]">{t("superAdmin.tierQuotaFieldStorageGb")}</dt>
                    <dd className="font-medium tabular-nums">{d.maxStorageGb || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#7F8C8D]">{t("superAdmin.billingTierLegacyPriceShort")}</dt>
                    <dd className="font-medium tabular-nums">
                      {tierBillingPriceStr[tier] || "—"} AZN
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className={`${SECONDARY_BUTTON_CLASS} mt-4 w-full`}
                  onClick={() => openTierModal(tier)}
                >
                  {t("superAdmin.billingEditTier")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={editTier !== null} onOpenChange={(o) => !o && setEditTier(null)}>
        <DialogContent className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}>
          <DialogHeader className="flex flex-row items-start justify-between gap-2 pr-8">
            <div>
              <h2 className="text-lg font-semibold text-[#34495E]">
                {editTier ? `${t("superAdmin.billingEditTier")} · ${editTier}` : ""}
              </h2>
            </div>
            <button
              type="button"
              className={MODAL_CLOSE_BUTTON_CLASS}
              aria-label={t("common.close")}
              onClick={() => setEditTier(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
          <div className="space-y-4 p-6 pt-0">
            <label className="block text-[13px] text-[#34495E]">
              {t("superAdmin.billingTierLegacyPrice")}
              <input
                className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
                value={modalTierPrice}
                onChange={(e) => setModalTierPrice(e.target.value)}
              />
            </label>
            <label className="block text-[13px] text-[#34495E]">
              {t("superAdmin.tierQuotaFieldEmployees")}
              <input
                className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
                value={modalQuotas.maxEmployees}
                onChange={(e) =>
                  setModalQuotas((q) => ({ ...q, maxEmployees: e.target.value }))
                }
              />
            </label>
            <label className="block text-[13px] text-[#34495E]">
              {t("superAdmin.tierQuotaFieldInvoicesMonthShort")}
              <input
                className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
                value={modalQuotas.maxInvoicesPerMonth}
                onChange={(e) =>
                  setModalQuotas((q) => ({
                    ...q,
                    maxInvoicesPerMonth: e.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-[13px] text-[#34495E]">
              {t("superAdmin.tierQuotaFieldStorageGb")}
              <input
                className="mt-1.5 box-border h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-[13px]"
                value={modalQuotas.maxStorageGb}
                onChange={(e) =>
                  setModalQuotas((q) => ({ ...q, maxStorageGb: e.target.value }))
                }
              />
            </label>
          </div>
          <div className={`${MODAL_FOOTER_ACTIONS_CLASS} mt-6 px-6 pb-6`}>
            <Button variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => setEditTier(null)}>
              {t("common.close")}
            </Button>
            <Button className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => void saveTierModal()}>
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
