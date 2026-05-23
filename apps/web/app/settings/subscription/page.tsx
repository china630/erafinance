"use client";

import Link from "next/link";
import {
  Building2,
  Calculator,
  ClipboardList,
  Factory,
  Landmark,
  Lock,
  Package,
  ReceiptText,
  Receipt,
  Ship,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { pricingModuleLabel } from "../../../lib/pricing-module-label";
import {
  CARD_CONTAINER_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import {
  useSubscription,
} from "../../../lib/subscription-context";
import { useAuth } from "../../../lib/auth-context";
import { canAccessBilling } from "../../../lib/role-utils";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { EmptyState } from "../../../components/empty-state";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";
import { intlLocaleRuAz } from "../../../lib/i18n/ui-lang";

type PlatformInvoiceRow = {
  id: string;
  amount: string;
  status: string;
  date: string;
  periodStart: string | null;
  periodEnd: string | null;
  pdfUrl: string;
  paymentOrderId: string | null;
  createdAt: string;
};

type MarketplaceBundle = {
  id: string;
  name: string;
  discountPercent: number;
  moduleKeys: string[];
  listPriceAzn: number;
  discountedPriceAzn: number;
  active: boolean;
  pendingDeactivation: boolean;
  incrementalPriceAzn: number;
};

type MarketplaceModule = {
  key: string;
  name: string;
  pricePerMonth: number;
  active: boolean;
  coveredByBundle: boolean;
  coveredByBundleName: string | null;
  pendingDeactivation: boolean;
  billableStandalone: boolean;
};

type MarketplacePremium = {
  key: string;
  monthlyAzn: number;
  activated: boolean;
  trialLocked: boolean;
};

type MarketplaceSnapshot = {
  currency: string;
  foundationMonthlyAzn: number;
  bundles: MarketplaceBundle[];
  modules: MarketplaceModule[];
  premiumModules: MarketplacePremium[];
  allocation: { totalModulesAzn: number };
  monthlyTotalAzn: number;
  isTrial: boolean;
};

function isModuleActiveInSubscription(
  active: string[],
  key: string,
): boolean {
  if (active.includes(key)) return true;
  if (key === "manufacturing") return active.includes("production");
  if (key === "ifrs_mapping") return active.includes("ifrs");
  return false;
}

function moduleIcon(key: string) {
  const common = "h-5 w-5 shrink-0 text-[#2980B9]";
  switch (key) {
    case "cash_bank_pro":
      return <Wallet className={common} aria-hidden />;
    case "inventory":
      return <Package className={common} aria-hidden />;
    case "manufacturing":
      return <Factory className={common} aria-hidden />;
    case "hr_full":
      return <Users className={common} aria-hidden />;
    case "tax_pro":
      return <ReceiptText className={common} aria-hidden />;
    case "trade_pro":
      return <Ship className={common} aria-hidden />;
    case "ifrs_mapping":
      return <Calculator className={common} aria-hidden />;
    case "audit_hub":
      return <ClipboardList className={common} aria-hidden />;
    default:
      return <Package className={common} aria-hidden />;
  }
}

function storageUsedGb(currentBytes: string): number {
  try {
    const b = BigInt(currentBytes);
    return Math.round((Number(b) / 1024 ** 3) * 100) / 100;
  } catch {
    return 0;
  }
}

function QuotaProgress({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number | null;
}) {
  const pct =
    max == null || max === 0 ? 0 : Math.min(100, (current / max) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[13px] text-[#34495E]">
        <span>{label}</span>
        <span className="font-medium tabular-nums text-[#34495E]">
          {max == null ? (
            <span>
              {current}{" "}
              <span className="text-[#7F8C8D] font-normal">(∞)</span>
            </span>
          ) : (
            <>
              {current} / {max}
            </>
          )}
        </span>
      </div>
      {max != null && (
        <div className="h-2 w-full overflow-hidden rounded-lg bg-[#EBEDF0]">
          <div
            className="h-full rounded-lg bg-[#2980B9] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function SubscriptionSettingsPage() {
  const { t, i18n } = useTranslation();
  useRequireAuth();
  const { token, ready, user, organizations, organizationId } = useAuth();
  const {
    effectiveSnapshot,
    ready: subReady,
    fetchError,
    refetch,
  } = useSubscription();
  const [marketplace, setMarketplace] = useState<MarketplaceSnapshot | null>(
    null,
  );
  const [marketplaceErr, setMarketplaceErr] = useState<string | null>(null);
  const [moduleBusyKey, setModuleBusyKey] = useState<string | null>(null);
  const [bundleBusyId, setBundleBusyId] = useState<string | null>(null);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [platformInvoices, setPlatformInvoices] = useState<PlatformInvoiceRow[]>(
    [],
  );
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesErr, setInvoicesErr] = useState<string | null>(null);

  const [consentModal, setConsentModal] = useState<
    | null
    | {
        kind: "module";
        mode: "enable" | "disable";
        moduleKey: string;
        monthlyAzn: string;
      }
    | {
        kind: "bundle";
        mode: "enable" | "disable";
        bundleId: string;
        bundleName: string;
        monthlyAzn: string;
      }
  >(null);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [premiumSelection, setPremiumSelection] = useState<string[]>([]);
  const [premiumConfirmCommercial, setPremiumConfirmCommercial] =
    useState(false);

  const locale = intlLocaleRuAz(i18n.language);

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === organizationId) ?? null,
    [organizations, organizationId],
  );

  useEffect(() => {
    if (!token) {
      setPlatformInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    if (!canAccessBilling(user?.role ?? undefined)) {
      setPlatformInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    let cancelled = false;
    setInvoicesLoading(true);
    setInvoicesErr(null);
    void (async () => {
      const res = await apiFetch("/api/billing/invoices?page=1&pageSize=50");
      if (cancelled) return;
      if (!res.ok) {
        setInvoicesErr(await res.text());
        setPlatformInvoices([]);
        setInvoicesLoading(false);
        return;
      }
      const data = (await res.json()) as { items: PlatformInvoiceRow[] };
      setPlatformInvoices(data.items ?? []);
      setInvoicesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.role]);

  const loadMarketplace = useCallback(async () => {
    if (!token || !canAccessBilling(user?.role ?? undefined)) {
      setMarketplace(null);
      return;
    }
    setMarketplaceErr(null);
    const res = await apiFetch("/api/billing/marketplace");
    if (!res.ok) {
      setMarketplaceErr(await res.text());
      setMarketplace(null);
      return;
    }
    setMarketplace((await res.json()) as MarketplaceSnapshot);
  }, [token, user?.role]);

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace, organizationId]);

  const expiresLabel = useMemo(() => {
    if (!effectiveSnapshot?.expiresAt)
      return t("subscriptionSettings.expiresNone");
    try {
      return new Date(effectiveSnapshot.expiresAt).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return effectiveSnapshot.expiresAt;
    }
  }, [effectiveSnapshot?.expiresAt, locale, t]);

  const activeModules = effectiveSnapshot?.activeModules ?? [];
  const isTIER_3 = effectiveSnapshot?.tier === "TIER_3";
  const readOnlySub = Boolean(effectiveSnapshot?.readOnly);

  const monthlyTotalAzn = useMemo(() => {
    if (marketplace) return marketplace.monthlyTotalAzn;
    return null;
  }, [marketplace]);

  const isModuleOn = useCallback(
    (mod: MarketplaceModule) => {
      if (isTIER_3) return true;
      return mod.active;
    },
    [isTIER_3],
  );

  const onToggleModule = (mod: MarketplaceModule, next: boolean) => {
    if (!token || isTIER_3 || readOnlySub) return;
    if (mod.coveredByBundle && next) {
      toast.message(
        t("subscriptionSettings.moduleInBundleHint", {
          bundle: mod.coveredByBundleName ?? "",
        }),
      );
      return;
    }
    setErr(null);
    setMsg(null);
    setConsentModal({
      kind: "module",
      mode: next ? "enable" : "disable",
      moduleKey: mod.key,
      monthlyAzn: mod.pricePerMonth.toFixed(2),
    });
  };

  const onToggleBundle = (b: MarketplaceBundle, next: boolean) => {
    if (!token || isTIER_3 || readOnlySub) return;
    setErr(null);
    setMsg(null);
    const monthly =
      next && b.incrementalPriceAzn > 0
        ? b.incrementalPriceAzn
        : b.discountedPriceAzn;
    setConsentModal({
      kind: "bundle",
      mode: next ? "enable" : "disable",
      bundleId: b.id,
      bundleName: b.name,
      monthlyAzn: monthly.toFixed(2),
    });
  };

  const confirmConsent = async () => {
    if (!consentModal || !token) return;
    const next = consentModal.mode === "enable";
    if (consentModal.kind === "module") {
      const moduleKey = consentModal.moduleKey;
      setModuleBusyKey(moduleKey);
      setConsentModal(null);
      try {
        const res = await apiFetch("/api/billing/toggle-module", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleKey, enabled: next }),
        });
        const data = (await res.json()) as { note?: string };
        if (!res.ok) {
          setErr(
            typeof data === "object" ? JSON.stringify(data) : await res.text(),
          );
          return;
        }
        toast.message(
          next
            ? t("subscriptionSettings.modulesUpdated")
            : data.note === "cancellation_scheduled_end_of_month"
              ? t("billing.subscription.disableScheduled")
              : t("subscriptionSettings.modulesUpdated"),
        );
        await refetch();
        await loadMarketplace();
      } finally {
        setModuleBusyKey(null);
      }
      return;
    }

    const bundleId = consentModal.bundleId;
    setBundleBusyId(bundleId);
    setConsentModal(null);
    try {
      const res = await apiFetch("/api/billing/toggle-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId, enabled: next }),
      });
      const data = (await res.json()) as { note?: string };
      if (!res.ok) {
        setErr(
          typeof data === "object" ? JSON.stringify(data) : await res.text(),
        );
        return;
      }
      toast.message(
        next
          ? t("subscriptionSettings.bundleUpdated")
          : data.note === "bundle_cancellation_scheduled_end_of_month"
            ? t("subscriptionSettings.bundleDisableScheduled")
            : t("subscriptionSettings.bundleUpdated"),
      );
      await refetch();
      await loadMarketplace();
    } finally {
      setBundleBusyId(null);
    }
  };

  const onActivatePremium = async () => {
    if (!token || premiumSelection.length === 0 || !premiumConfirmCommercial) {
      return;
    }
    setPremiumBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/billing/activate-premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modules: premiumSelection,
          confirmCommercialStatus: true,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setErr(
          typeof data === "object" ? JSON.stringify(data) : await res.text(),
        );
        return;
      }
      toast.success(t("subscriptionSettings.premiumActivated"));
      setPremiumModalOpen(false);
      setPremiumSelection([]);
      setPremiumConfirmCommercial(false);
      await refetch();
      await loadMarketplace();
    } finally {
      setPremiumBusy(false);
    }
  };

  const onPay = async () => {
    if (!token || monthlyTotalAzn == null || monthlyTotalAzn <= 0) return;
    setPayBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountAzn: Math.round(monthlyTotalAzn * 100) / 100,
          months: 1,
        }),
      });
      if (!res.ok) {
        setErr(await res.text());
        return;
      }
      const data = (await res.json()) as { paymentUrl?: string };
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setErr(t("subscriptionSettings.payNoUrl"));
    } finally {
      setPayBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="text-[#7F8C8D]">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  if (!canAccessBilling(user?.role ?? undefined)) {
    return (
      <div className="max-w-3xl space-y-4">
        <EmptyState
          title={t("billing.subscription.ownerOnlyAz")}
          description={t("subscriptionSettings.ownerOnlyBody")}
          icon={
            <Lock className="h-12 w-12 mx-auto text-[#2980B9]" aria-hidden />
          }
          action={
            <Link href="/home" className={LINK_ACCENT_CLASS}>
              {t("common.backHome")}
            </Link>
          }
        />
      </div>
    );
  }

  if (!subReady) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-[#7F8C8D]">{t("common.loading")}</p>
      </div>
    );
  }

  if (fetchError && !effectiveSnapshot) {
    return (
      <div
        className={`max-w-3xl ${CARD_CONTAINER_CLASS} border-amber-200 bg-amber-50/90 p-8 text-center space-y-4`}
      >
        <p className="font-medium text-amber-950">{t("subscription.loadErr")}</p>
        <p className="text-sm text-amber-900/90">
          {t("subscription.loadErrHint")}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className={PRIMARY_BUTTON_CLASS}
        >
          {t("common.retryCheck")}
        </button>
      </div>
    );
  }

  if (!effectiveSnapshot) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-[#7F8C8D]">{t("common.loading")}</p>
      </div>
    );
  }

  const switchDisabled = readOnlySub || isTIER_3;

  return (
    <div className="relative z-10 max-w-4xl space-y-6">
      <PageHeader
        title={t("subscriptionSettings.title")}
        subtitle={
          <>
            <p className="text-[13px] text-[#7F8C8D]">
              {t("subscriptionSettings.subtitleV10")}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[13px] items-center">
              <Link href="/home" className={LINK_ACCENT_CLASS}>
                {t("nav.home")}
              </Link>
              <span className="text-[#D5DADF]">/</span>
              <span className="text-[#34495E]">{t("subscriptionSettings.title")}</span>
            </div>
          </>
        }
      />

      {msg && (
        <p className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}
      {err && (
        <p className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {err}
        </p>
      )}

      <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="mt-0.5 rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-2">
              <Building2 className="h-6 w-6 text-[#2980B9]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                {t("subscriptionSettings.currentOrganization")}
              </h2>
              <p className="text-lg font-semibold text-[#34495E] truncate">
                {currentOrg?.name ?? "—"}
              </p>
              {currentOrg?.taxId ? (
                <p className="text-[13px] text-[#7F8C8D] mt-0.5">
                  {t("subscriptionSettings.voenLabel")}: {currentOrg.taxId}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right text-[13px] text-[#7F8C8D]">
            <div className="font-semibold uppercase tracking-wide text-amber-800">
              {t("subscriptionSettings.currentPlan")}
            </div>
            <div className="text-[#34495E] font-semibold mt-1">
              {effectiveSnapshot.tier}
            </div>
            {effectiveSnapshot.isTrial && (
              <span className="inline-block mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 px-2 py-0.5 rounded-lg">
                {t("subscriptionSettings.trial")}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#EBEDF0] text-[13px]">
          <div>
            <div className="text-[#7F8C8D] text-xs font-semibold uppercase tracking-wide">
              {t("subscriptionSettings.expiresAt")}
            </div>
            <div className="text-[#34495E] font-medium mt-0.5">{expiresLabel}</div>
          </div>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <h2 className="text-lg font-semibold text-[#34495E]">
          {t("subscriptionSettings.usage")}
        </h2>
        <QuotaProgress
          label={t("subscriptionSettings.quotaEmployees")}
          current={effectiveSnapshot.quotas.employees.current}
          max={effectiveSnapshot.quotas.employees.max}
        />
        <QuotaProgress
          label={t("subscriptionSettings.quotaInvoices")}
          current={effectiveSnapshot.quotas.invoicesThisMonth.current}
          max={effectiveSnapshot.quotas.invoicesThisMonth.max}
        />
        <QuotaProgress
          label={t("subscriptionSettings.quotaStorage")}
          current={storageUsedGb(
            effectiveSnapshot.quotas.storage?.currentBytes ?? "0",
          )}
          max={effectiveSnapshot.quotas.storage?.maxGb ?? null}
        />
        <div className="space-y-1 pt-1 border-t border-[#EBEDF0]">
          <div className="flex justify-between text-[13px] text-[#34495E]">
            <span>{t("subscriptionSettings.quotaWhatsappOutbound")}</span>
            <span className="font-medium tabular-nums text-[#34495E]">
              {effectiveSnapshot.quotas.whatsappOutbound.balance}
            </span>
          </div>
          <p className="text-[12px] text-[#7F8C8D] leading-snug m-0">
            {t("subscriptionSettings.quotaWhatsappOutboundHint")}
          </p>
        </div>
      </section>

      {canAccessBilling(user?.role ?? undefined) && (
        <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
          <h2 className="text-lg font-semibold text-[#34495E]">
            {t("subscriptionSettings.platformInvoicesTitle")}
          </h2>
          <p className="text-[13px] text-[#7F8C8D]">
            {t("subscriptionSettings.platformInvoicesHint")}
          </p>
          {invoicesErr && (
            <p className="text-[13px] text-red-700">{invoicesErr}</p>
          )}
          {invoicesLoading && (
            <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
          )}
          {!invoicesLoading && platformInvoices.length === 0 && !invoicesErr && (
            <p className="text-[13px] text-[#7F8C8D]">
              {t("subscriptionSettings.platformInvoicesEmpty")}
            </p>
          )}
          {platformInvoices.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-[#D5DADF]">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-[#F8F9FA] text-[#7F8C8D] uppercase text-[11px] tracking-wide">
                  <tr>
                    <th className="px-3 py-2 font-semibold">
                      {t("subscriptionSettings.invColDate")}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {t("subscriptionSettings.invColAmount")}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {t("subscriptionSettings.invColStatus")}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {t("subscriptionSettings.invColPdf")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBEDF0] text-[#34495E]">
                  {platformInvoices.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{row.amount} AZN</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className={LINK_ACCENT_CLASS}
                          onClick={async () => {
                            const res = await apiFetch(
                              `/api/billing/invoices/${row.id}/pdf`,
                            );
                            if (!res.ok) {
                              toast.error(t("subscriptionSettings.pdfDownloadErr"));
                              return;
                            }
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `platform-invoice-${row.id.slice(0, 8)}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          {t("subscriptionSettings.downloadPdf")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {readOnlySub && (
        <p className="text-[13px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {t("subscriptionSettings.readOnlyModules")}
        </p>
      )}
      {isTIER_3 && (
        <p className="text-[13px] text-[#34495E] bg-[#EBEDF0] border border-[#D5DADF] rounded-lg px-3 py-2">
          {t("subscriptionSettings.enterpriseAllModules")}
        </p>
      )}

      {marketplace && marketplace.bundles.length > 0 && (
        <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
          <div>
            <h2 className="text-lg font-semibold text-[#34495E]">
              {t("subscriptionSettings.packagesTitle")}
            </h2>
            <p className="text-[13px] text-[#7F8C8D] mt-1">
              {t("subscriptionSettings.packagesHint")}
            </p>
          </div>
          <ul className="divide-y divide-[#EBEDF0] rounded-2xl border border-[#D5DADF] bg-white">
            {marketplace.bundles.map((b) => {
              const busy = bundleBusyId === b.id;
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[#34495E]">
                      {b.name}
                    </div>
                    <p className="text-[12px] text-[#7F8C8D] mt-0.5">
                      {b.moduleKeys.join(", ")}
                    </p>
                    {b.pendingDeactivation && (
                      <div className="mt-1 inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        {t("subscriptionSettings.pendingDeactivationBadge")}
                      </div>
                    )}
                    <div className="text-[12px] text-[#7F8C8D] mt-0.5 tabular-nums">
                      {b.discountPercent > 0 && (
                        <span className="line-through mr-2">
                          {b.listPriceAzn.toFixed(2)}
                        </span>
                      )}
                      <span className="text-[#2980B9] font-medium">
                        {b.discountedPriceAzn.toFixed(2)} AZN
                      </span>{" "}
                      / {t("subscriptionSettings.perMonth")}
                      {!b.active && b.incrementalPriceAzn > 0 && (
                        <span className="ml-2 text-emerald-800">
                          (+{b.incrementalPriceAzn.toFixed(2)}{" "}
                          {t("subscriptionSettings.incrementalLabel")})
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={b.active}
                    aria-label={b.name}
                    disabled={switchDisabled || busy}
                    onClick={() => onToggleBundle(b, !b.active)}
                    className={[
                      "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#2980B9] focus:ring-offset-1",
                      b.active
                        ? "border-[#2980B9] bg-[#2980B9]"
                        : "border-[#D5DADF] bg-[#EBEDF0]",
                      switchDisabled || busy
                        ? "opacity-50 cursor-not-allowed"
                        : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transition-transform",
                        b.active ? "translate-x-7" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div>
          <h2 className="text-lg font-semibold text-[#34495E]">
            {t("subscriptionSettings.modulesTitle")}
          </h2>
          <p className="text-[13px] text-[#7F8C8D] mt-1">
            {t("subscriptionSettings.modulesHintDedup")}
          </p>
        </div>
        {marketplaceErr && (
          <p className="text-[13px] text-red-700">{marketplaceErr}</p>
        )}
        {!marketplace && !marketplaceErr && (
          <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
        )}
        {marketplace && (
          <ul className="divide-y divide-[#EBEDF0] rounded-2xl border border-[#D5DADF] bg-white">
            {marketplace.modules.map((mod) => {
              const on = isModuleOn(mod);
              const busy = moduleBusyKey === mod.key;
              const pending = mod.pendingDeactivation;
              const moduleSwitchDisabled =
                switchDisabled || mod.coveredByBundle;
              return (
                <li
                  key={mod.key}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {moduleIcon(mod.key)}
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#34495E]">
                        {pricingModuleLabel(mod.key, mod.name, t)}
                      </div>
                      {pending && (
                        <div className="mt-1 inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          {t("subscriptionSettings.pendingDeactivationBadge")}
                        </div>
                      )}
                      {mod.coveredByBundle && (
                        <div className="mt-1 inline-flex rounded-lg border border-[#2980B9]/30 bg-[#EBF5FB] px-2 py-0.5 text-[11px] font-semibold text-[#2980B9]">
                          {t("subscriptionSettings.inPackageBadge", {
                            name: mod.coveredByBundleName ?? "",
                          })}
                        </div>
                      )}
                      <div className="text-[12px] text-[#7F8C8D] mt-0.5 tabular-nums">
                        +{mod.pricePerMonth.toFixed(2)} AZN /{" "}
                        {t("subscriptionSettings.perMonth")}
                        {mod.coveredByBundle && (
                          <span className="ml-1 text-emerald-800">
                            ({t("subscriptionSettings.notBilledTwice")})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={pricingModuleLabel(mod.key, mod.name, t)}
                    disabled={moduleSwitchDisabled || busy}
                    onClick={() => onToggleModule(mod, !on)}
                    className={[
                      "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#2980B9] focus:ring-offset-1",
                      on
                        ? "border-[#2980B9] bg-[#2980B9]"
                        : "border-[#D5DADF] bg-[#EBEDF0]",
                      moduleSwitchDisabled || busy
                        ? "opacity-50 cursor-not-allowed"
                        : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transition-transform",
                        on ? "translate-x-7" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {marketplace && marketplace.premiumModules.length > 0 && (
        <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
          <h2 className="text-lg font-semibold text-[#34495E]">
            {t("subscriptionSettings.premiumTitle")}
          </h2>
          <p className="text-[13px] text-[#7F8C8D]">
            {t("subscriptionSettings.premiumHint")}
          </p>
          <ul className="divide-y divide-[#EBEDF0] rounded-2xl border border-[#D5DADF] bg-white">
            {marketplace.premiumModules.map((p) => (
              <li
                key={p.key}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <div className="text-[13px] font-medium text-[#34495E]">
                    {pricingModuleLabel(p.key, p.key, t)}
                  </div>
                  <div className="text-[12px] text-[#7F8C8D] tabular-nums">
                    {p.monthlyAzn.toFixed(2)} AZN /{" "}
                    {t("subscriptionSettings.perMonth")}
                  </div>
                  {p.trialLocked && !p.activated && (
                    <p className="text-[11px] text-amber-900 mt-1">
                      {t("subscriptionSettings.premiumTrialLocked")}
                    </p>
                  )}
                </div>
                <span
                  className={[
                    "text-[11px] font-semibold uppercase px-2 py-0.5 rounded-lg",
                    p.activated
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      : "bg-[#EBEDF0] text-[#7F8C8D]",
                  ].join(" ")}
                >
                  {p.activated
                    ? t("subscriptionSettings.premiumActive")
                    : t("subscriptionSettings.premiumInactive")}
                </span>
              </li>
            ))}
          </ul>
          {marketplace.premiumModules.some((p) => p.trialLocked && !p.activated) && (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={readOnlySub || premiumBusy}
              onClick={() => {
                setPremiumSelection(
                  marketplace.premiumModules
                    .filter((p) => !p.activated)
                    .map((p) => p.key),
                );
                setPremiumConfirmCommercial(false);
                setPremiumModalOpen(true);
              }}
            >
              {t("subscriptionSettings.premiumActivateCta")}
            </button>
          )}
        </section>
      )}

      {marketplace && monthlyTotalAzn != null && (
        <section
          className={`${CARD_CONTAINER_CLASS} p-6 space-y-4 border-[#2980B9]/25 bg-white`}
        >
          <h2 className="text-lg font-semibold text-[#34495E] flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#2980B9]" aria-hidden />
            {t("subscriptionSettings.totalDueTitle")}
          </h2>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[#7F8C8D] text-[13px]">
                {t("subscriptionSettings.totalBase")}
              </dt>
              <dd className="tabular-nums font-medium text-[#34495E]">
                {marketplace.foundationMonthlyAzn.toFixed(2)} AZN
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#7F8C8D] text-[13px]">
                {t("subscriptionSettings.totalModulesAndPackages")}
              </dt>
              <dd className="tabular-nums font-medium text-[#34495E]">
                {marketplace.allocation.totalModulesAzn.toFixed(2)} AZN
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-[#EBEDF0] pt-3 mt-1">
              <dt className="font-semibold text-[#34495E]">
                {t("subscriptionSettings.totalMonthly")}
              </dt>
              <dd className="tabular-nums text-lg font-bold text-[#2980B9]">
                {monthlyTotalAzn.toFixed(2)} AZN
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section
        className={`${CARD_CONTAINER_CLASS} p-6 space-y-4 border-dashed border-[#2980B9]/40`}
      >
        <h2 className="text-lg font-semibold text-[#34495E]">
          {t("subscriptionSettings.billingTitle")}
        </h2>
        <p className="text-[13px] text-[#7F8C8D]">
          {t("subscriptionSettings.billingMockHint")}
        </p>
        <button
          type="button"
          disabled={payBusy || readOnlySub || monthlyTotalAzn == null}
          onClick={() => void onPay()}
          className={PRIMARY_BUTTON_CLASS}
        >
          {payBusy ? "…" : t("subscriptionSettings.payButton")}
        </button>
      </section>

      {consentModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}>
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
                {consentModal.kind === "bundle"
                  ? consentModal.mode === "enable"
                    ? t("subscriptionSettings.consentBundleEnableTitle", {
                        name: consentModal.bundleName,
                      })
                    : t("subscriptionSettings.consentBundleDisableTitle", {
                        name: consentModal.bundleName,
                      })
                  : consentModal.mode === "enable"
                    ? t("subscriptionSettings.consentEnableTitle")
                    : t("subscriptionSettings.consentDisableTitle")}
              </h3>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setConsentModal(null)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </header>
            <p className="m-0 mt-4 text-[13px] leading-relaxed text-[#34495E]">
              {consentModal.mode === "enable"
                ? t("subscriptionSettings.consentEnableBody", {
                    monthly: consentModal.monthlyAzn,
                  })
                : t("subscriptionSettings.consentDisableBody")}
            </p>
            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => setConsentModal(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => void confirmConsent()}>
                {t("subscriptionSettings.consentConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {premiumModalOpen && marketplace && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}>
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
                {t("subscriptionSettings.premiumModalTitle")}
              </h3>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setPremiumModalOpen(false)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </header>
            <p className="m-0 mt-4 text-[13px] text-[#7F8C8D]">
              {t("subscriptionSettings.premiumModalHint")}
            </p>
            <ul className="mt-4 space-y-2">
              {marketplace.premiumModules
                .filter((p) => !p.activated)
                .map((p) => (
                  <li key={p.key}>
                    <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
                      <input
                        type="checkbox"
                        checked={premiumSelection.includes(p.key)}
                        onChange={(e) => {
                          setPremiumSelection((prev) =>
                            e.target.checked
                              ? [...prev, p.key]
                              : prev.filter((k) => k !== p.key),
                          );
                        }}
                      />
                      {pricingModuleLabel(p.key, p.key, t)} —{" "}
                      {p.monthlyAzn.toFixed(2)} AZN
                    </label>
                  </li>
                ))}
            </ul>
            <label className="mt-4 flex items-start gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                checked={premiumConfirmCommercial}
                onChange={(e) => setPremiumConfirmCommercial(e.target.checked)}
              />
              {t("subscriptionSettings.premiumCommercialConfirm")}
            </label>
            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => setPremiumModalOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={
                  premiumBusy ||
                  premiumSelection.length === 0 ||
                  !premiumConfirmCommercial
                }
                onClick={() => void onActivatePremium()}
              >
                {t("subscriptionSettings.premiumActivateCta")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

