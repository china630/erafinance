import type { PricingStorefrontUiCopy } from "@erafinance/i18n/pricing-storefront-copy";
import type { MeterUnitPricing, PublicPricingResponse } from "../public-pricing-types";

export type PricingStorefrontView = {
  currency: "AZN";
  unavailable: boolean;
  hero: {
    title: string;
    subtitle: string;
    ctaRegister: string;
    ctaLogin: string;
  };
  foundation: {
    title: string;
    description: string;
    trialPrice: string;
    trialBadge: string;
    postTrialLine: string;
    meterMayBillLine: string;
    foundationMonthlyAzn: number;
  };
  coreSuiteTitle: string;
  coreSuiteIntro: string;
  trialPromoText: string;
  trialPromoButton: string;
  standardModules: Array<{
    id: string;
    name: string;
    subtitle: string;
    bullets: string[];
    pricePerMonthAzn: number;
  }>;
  bundles: Array<{
    marketingId: string;
    name: string;
    moduleLine: string;
    discountBadge: string;
    listPriceAzn: number;
    discountedPriceAzn: number;
    moduleKeys: string[];
    ctaHref: string;
  }>;
  tiers: Array<{
    id: "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";
    columnTitle: string;
    spendCeilingLabel: string;
    ctaLabel: string;
    ctaVariant: "current" | "upgrade";
    checkoutTier?: "TIER_1" | "TIER_2" | "TIER_3";
    spendCeilingAzn: number;
  }>;
  premiumModules: Array<{
    slug: string;
    name: string;
    description: string;
    priceLabel: string;
    pricePerMonth: number;
    bullets: string[];
  }>;
  calculator: {
    dueTodayLabel: string;
    postpaidLabel: string;
    bakuNotice: string;
  };
  meterUnitPricing: MeterUnitPricing;
  unitPriceLabels: {
    users: string;
    invoices: string;
    storage: string;
    whatsapp: string;
    ocr: string;
    metricColumn: string;
  };
  matrixTitle: string;
  matrixHint: string;
  bundlesTitle: string;
  bundlesHint: string;
  bundlePopularBadge: string;
  bundleSavingsLabel: string;
  premiumTitle: string;
  premiumHint: string;
  premiumLockedTitle: string;
  premiumUpgradeCta: string;
  standardModulesTitle: string;
  standardModulesHint: string;
  pricePerMonthSuffix: string;
  bundleCtaLabel: string;
};

function fmtAzn(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN`;
}

function tierColumnTitle(id: string): string {
  const map: Record<string, string> = {
    TIER_0: "Tier 0 · Starter",
    TIER_1: "Tier 1 · Growth",
    TIER_2: "Tier 2 · Scale",
    TIER_3: "Tier 3 · Enterprise",
  };
  return map[id] ?? id;
}

const DEFAULT_METER: MeterUnitPricing = {
  pricePerUserMonthAzn: 2,
  pricePerGbMonthAzn: 0.5,
  pricePerWhatsappAlertAzn: 0.05,
  pricePerInvoiceAzn: 0.1,
  pricePerOcrPageAzn: 0.02,
};

export function buildPricingStorefrontView(
  api: PublicPricingResponse,
  ui: PricingStorefrontUiCopy,
): PricingStorefrontView {
  const foundation = api.foundationMonthlyAzn ?? 0;
  const meter = api.meterUnitPricing ?? DEFAULT_METER;
  const postTrialLine = ui.corePostTrialTemplate.replace("{{price}}", fmtAzn(foundation));

  const standardModules = (api.standardModules ?? []).map((sm) => {
    const meta = ui.standardModules[sm.id];
    return {
      id: sm.id,
      name: meta?.name ?? sm.id,
      subtitle: meta?.subtitle ?? "",
      bullets: meta?.bullets ?? [],
      pricePerMonthAzn: sm.pricePerMonthAzn,
    };
  });

  const bundles = [...(api.bundles ?? [])]
    .filter((b) => b.discountedPriceAzn > 0)
    .sort((a, b) => b.discountedPriceAzn - a.discountedPriceAzn)
    .map((b) => {
    const meta = ui.bundles[b.marketingId];
    return {
      marketingId: b.marketingId,
      name: meta?.name ?? b.name,
      moduleLine: meta?.moduleLine ?? b.moduleKeys.join(", "),
      discountBadge: `${b.discountPercent}% ${ui.bundleDiscountSuffix}`,
      listPriceAzn: b.listPriceAzn,
      discountedPriceAzn: b.discountedPriceAzn,
      moduleKeys: b.moduleKeys,
      ctaHref: `/register-org?bundle=${encodeURIComponent(b.marketingId)}`,
    };
    });

  const tiers = (api.tiers ?? []).map((t) => {
    const isT0 = t.id === "TIER_0";
    const ceiling = t.spendCeilingAzn ?? 0;
    return {
      id: t.id,
      columnTitle: tierColumnTitle(t.id),
      spendCeilingLabel:
        ceiling <= 0 && isT0
          ? ui.tierSpendCeilingStarter
          : ui.tierSpendCeilingTemplate.replace("{{amount}}", fmtAzn(ceiling)),
      ctaLabel: isT0 ? ui.tierCurrentLabel : ui.tierSelectLabel,
      ctaVariant: isT0 ? ("current" as const) : ("upgrade" as const),
      checkoutTier: isT0 ? undefined : (t.id as "TIER_1" | "TIER_2" | "TIER_3"),
      spendCeilingAzn: ceiling,
    };
  });

  const premiumModules = (api.premiumModules ?? []).map((m) => {
    const feat = ui.premiumFeatures[m.key];
    return {
      slug: m.key,
      name: m.name,
      description: feat?.description ?? "",
      pricePerMonth: m.pricePerMonth,
      priceLabel: `+${fmtAzn(m.pricePerMonth)} ${ui.pricePerMonthSuffix}`,
      bullets: feat?.bullets ?? [],
    };
  });

  return {
    currency: "AZN",
    unavailable: Boolean(api.unavailable),
    hero: {
      title: ui.heroTitle,
      subtitle: ui.heroSubtitle,
      ctaRegister: ui.ctaRegister,
      ctaLogin: ui.ctaLogin,
    },
    foundation: {
      title: ui.foundationTitle,
      description: ui.foundationDescription,
      trialPrice: ui.coreTrialPriceLabel,
      trialBadge: ui.coreTrialBadge,
      postTrialLine,
      meterMayBillLine: ui.trialMeterMayBillLine,
      foundationMonthlyAzn: foundation,
    },
    meterUnitPricing: meter,
    standardModules,
    bundles,
    tiers,
    premiumModules,
    calculator: {
      dueTodayLabel: ui.calculatorDueTodayLabel,
      postpaidLabel: ui.calculatorPostpaidLabel,
      bakuNotice: ui.calculatorBakuNotice,
    },
    unitPriceLabels: {
      users: ui.resourceUsers,
      invoices: ui.resourceInvoices,
      storage: ui.resourceStorage,
      whatsapp: ui.resourceWhatsapp,
      ocr: ui.resourceOcr,
      metricColumn: ui.matrixMetricLabel,
    },
    matrixTitle: ui.matrixTitle,
    matrixHint: ui.spendTierMatrixHint,
    bundlesTitle: ui.bundlesTitle,
    bundlesHint: ui.bundlesHint,
    bundlePopularBadge: ui.bundlePopularBadge,
    bundleSavingsLabel: ui.bundleSavingsLabel,
    premiumTitle: ui.premiumTitle,
    premiumHint: ui.premiumHint,
    premiumLockedTitle: ui.premiumLockedTitle,
    premiumUpgradeCta: ui.premiumUpgradeCta,
    coreSuiteTitle: ui.coreSuiteTitle,
    coreSuiteIntro: ui.coreSuiteIntro,
    trialPromoText: ui.trialPromoText,
    trialPromoButton: ui.trialPromoButton,
    standardModulesTitle: ui.standardModulesTitle,
    standardModulesHint: ui.standardModulesHint,
    pricePerMonthSuffix: ui.pricePerMonthSuffix,
    bundleCtaLabel: ui.bundleCta,
  };
}
