import { cookies } from "next/headers";
import { PricingPageView } from "../../components/pricing/pricing-page-view";
import { uiLangRuAz } from "../../lib/i18n/ui-lang";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";

async function resolvePricingLocale(): Promise<"az" | "ru"> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("erafinance_i18n_lang")?.value;
  if (fromCookie) return uiLangRuAz(fromCookie);
  return "az";
}

export default async function PublicPricingPage() {
  const locale = await resolvePricingLocale();
  const snapshot = await fetchPublicPricingSnapshot();
  return <PricingPageView initialLocale={locale} snapshot={snapshot} />;
}
