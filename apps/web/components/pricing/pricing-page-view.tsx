"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildPricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";
import { computePricingTotals } from "../../lib/pricing/compute-pricing-totals";
import { getPricingStorefrontUiCopy } from "../../lib/i18n/pricing-storefront-copy";
import type { PublicPricingResponse } from "../../lib/public-pricing-types";
import { LandingLanguageToggle } from "../landing/landing-language-toggle";
import { PublicLegalFooter } from "../public-legal-footer";
import { PricingBundlesSection } from "./pricing-bundles-section";
import { PricingCheckoutBar } from "./pricing-checkout-bar";
import { PricingCoreSuiteSection } from "./pricing-core-suite-section";
import { PricingHeroSection } from "./pricing-hero-section";
import { PricingPageShell } from "./pricing-page-shell";
import { PricingPremiumPanel } from "./pricing-premium-panel";
import { PricingResourceMatrix } from "./pricing-resource-matrix";

const PRICING_LOGIN_BTN_CLASS =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm no-underline transition-all duration-200 hover:bg-slate-50";

export function PricingPageView({
  initialLocale,
  snapshot,
}: {
  initialLocale: "ru" | "az";
  snapshot: PublicPricingResponse;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [selectedTierId, setSelectedTierId] =
    useState<"TIER_0" | "TIER_1" | "TIER_2" | "TIER_3">("TIER_0");
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [selectedPremiumSlugs, setSelectedPremiumSlugs] = useState<string[]>([]);

  const view = useMemo(
    () => buildPricingStorefrontView(snapshot, getPricingStorefrontUiCopy(locale)),
    [snapshot, locale],
  );

  const totals = useMemo(
    () =>
      computePricingTotals(
        view,
        selectedTierId,
        selectedPremiumSlugs,
        selectedBundleId,
      ),
    [view, selectedTierId, selectedPremiumSlugs, selectedBundleId],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const togglePremium = (slug: string) => {
    setSelectedPremiumSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  return (
    <PricingPageShell>
      <header className="sticky top-0 z-20 border-b border-slate-300/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-slate-800 no-underline"
          >
            ERA Finance
          </Link>
          <div className="flex items-center gap-2">
            <LandingLanguageToggle locale={locale} onLocaleChange={setLocale} />
            <Link href="/login" className={PRICING_LOGIN_BTN_CLASS}>
              {view.hero.ctaLogin}
            </Link>
          </div>
        </div>
      </header>

      {view.unavailable ? (
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-amber-800">
          {locale === "ru"
            ? "Каталог цен временно недоступен. Показаны только тексты интерфейса."
            : "Qiymət kataloqu müvəqqəti əlçatan deyil. Yalnız interfeys mətnləri göstərilir."}
        </p>
      ) : null}

      <main className="pb-36">
        <PricingHeroSection hero={view.hero} />

        <PricingCoreSuiteSection
          coreSuiteTitle={view.coreSuiteTitle}
          coreSuiteIntro={view.coreSuiteIntro}
          standardModulesTitle={view.standardModulesTitle}
          foundation={view.foundation}
          standardModules={view.standardModules}
          perMonthSuffix={view.pricePerMonthSuffix}
          trialPromoText={view.trialPromoText}
          trialPromoButton={view.trialPromoButton}
        />

        <PricingBundlesSection
          title={view.bundlesTitle}
          hint={view.bundlesHint}
          bundles={view.bundles}
          bundleCtaLabel={view.bundleCtaLabel}
          bundlePopularBadge={view.bundlePopularBadge}
          perMonthSuffix={view.pricePerMonthSuffix}
          selectedBundleId={selectedBundleId}
          onSelectBundle={setSelectedBundleId}
        />

        <PricingPremiumPanel
          title={view.premiumTitle}
          hint={view.premiumHint}
          premiumModules={view.premiumModules}
          premiumLockedTitle={view.premiumLockedTitle}
          premiumUpgradeCta={view.premiumUpgradeCta}
          selectedPremiumSlugs={selectedPremiumSlugs}
          onTogglePremium={togglePremium}
        />

        <PricingResourceMatrix
          title={view.matrixTitle}
          hint={view.matrixHint}
          tiers={view.tiers}
          unitPriceLabels={view.unitPriceLabels}
          meterUnitPricing={view.meterUnitPricing}
          selectedTierId={selectedTierId}
          onSelectTier={setSelectedTierId}
        />

        <div className="px-4 pb-8">
          <PublicLegalFooter />
        </div>
      </main>

      <PricingCheckoutBar
        dueTodayLabel={totals.dueTodayLabel}
        postpaidLabel={totals.postpaidLabel}
        bakuNotice={view.calculator.bakuNotice}
      />
    </PricingPageShell>
  );
}
