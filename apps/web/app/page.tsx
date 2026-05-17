import { cookies, headers } from "next/headers";
import { LandingPageView } from "../components/landing/landing-page-view";
import { fetchLandingModules } from "../lib/landing-modules.server";
import { resources } from "../lib/i18n/resources";
import { uiLangRuAz } from "../lib/i18n/ui-lang";

async function resolveLandingLocale(): Promise<"az" | "ru"> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("erafinance_i18n_lang")?.value;
  if (fromCookie) return uiLangRuAz(fromCookie);
  const headerStore = await headers();
  const accept = headerStore.get("accept-language") ?? "";
  if (accept.toLowerCase().includes("ru")) return "ru";
  return "az";
}

export default async function LandingPage() {
  const locale = await resolveLandingLocale();
  const modules = await fetchLandingModules();
  const copy = resources[locale].translation.landing;

  return (
    <LandingPageView
      locale={locale}
      modules={modules}
      copy={{
        heroTitle: copy.heroTitle,
        heroSubtitle: copy.heroSubtitle,
        disclaimer: copy.disclaimer,
        ctaRegister: copy.ctaRegister,
        ctaPricing: copy.ctaPricing,
      }}
    />
  );
}
