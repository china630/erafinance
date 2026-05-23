"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";
import type { BillingPayload } from "../../../lib/super-admin/billing-types";
import {
  DEFAULT_METER_UNIT_PRICING,
  DEFAULT_TIER_SPEND_CEILINGS,
} from "../../../lib/super-admin/spend-tier-defaults";

type BillingContextValue = {
  billing: BillingPayload | null;
  billingLoading: boolean;
  billingLoadError: string | null;
  billingLoadTimedOut: boolean;
  loadBilling: () => Promise<void>;
  resetPricingCatalog: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

function normalizeBilling(raw: Partial<BillingPayload>): BillingPayload {
  return {
    prices: raw.prices ?? {},
    quotas: raw.quotas ?? {},
    ocrJobsPerOrgMonth:
      typeof raw.ocrJobsPerOrgMonth === "number" &&
      Number.isFinite(raw.ocrJobsPerOrgMonth)
        ? raw.ocrJobsPerOrgMonth
        : 200,
    foundationMonthlyAzn: raw.foundationMonthlyAzn ?? 29,
    yearlyDiscountPercent: raw.yearlyDiscountPercent ?? 20,
    quotaPricing: raw.quotaPricing ?? {
      employeeBlockSize: 10,
      pricePerEmployeeBlockAzn: 15,
      documentPackSize: 1000,
      pricePerDocumentPackAzn: 5,
    },
    pricingModules: raw.pricingModules ?? [],
    pricingBundles: raw.pricingBundles ?? [],
    meterUnitPricing: {
      ...DEFAULT_METER_UNIT_PRICING,
      ...raw.meterUnitPricing,
    },
    tierSpendCeilings: {
      ...DEFAULT_TIER_SPEND_CEILINGS,
      ...raw.tierSpendCeilings,
    },
  };
}

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [billing, setBilling] = useState<BillingPayload | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingLoadError, setBillingLoadError] = useState<string | null>(null);
  const [billingLoadTimedOut, setBillingLoadTimedOut] = useState(false);

  const loadBilling = useCallback(async () => {
    if (!token) return;
    setBillingLoading(true);
    setBillingLoadError(null);
    setBillingLoadTimedOut(false);
    try {
      const res = await apiFetch("/api/admin/config/billing");
      if (!res.ok) {
        setBillingLoadError(`HTTP ${res.status}`);
        setBilling(null);
        return;
      }
      const raw = (await res.json()) as Partial<BillingPayload>;
      setBilling(normalizeBilling(raw));
      setBillingLoadTimedOut(false);
    } catch (e) {
      setBillingLoadError(e instanceof Error ? e.message : "error");
      setBilling(null);
    } finally {
      setBillingLoading(false);
    }
  }, [token]);

  const resetPricingCatalog = useCallback(async () => {
    if (!token) return;
    setBillingLoadError(null);
    try {
      const res = await apiFetch("/api/admin/config/billing/seed-pricing", {
        method: "POST",
      });
      if (!res.ok) {
        setBillingLoadError(`HTTP ${res.status}`);
        return;
      }
      await loadBilling();
    } catch (e) {
      setBillingLoadError(e instanceof Error ? e.message : "error");
    }
  }, [token, loadBilling]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    if (!billingLoading) return;
    const id = window.setTimeout(() => setBillingLoadTimedOut(true), 5000);
    return () => window.clearTimeout(id);
  }, [billingLoading]);

  const value = useMemo(
    () => ({
      billing,
      billingLoading,
      billingLoadError,
      billingLoadTimedOut,
      loadBilling,
      resetPricingCatalog,
    }),
    [
      billing,
      billingLoading,
      billingLoadError,
      billingLoadTimedOut,
      loadBilling,
      resetPricingCatalog,
    ],
  );

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) {
    throw new Error("useBilling must be used within BillingProvider");
  }
  return ctx;
}
