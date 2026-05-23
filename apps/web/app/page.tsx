import { cookies } from "next/headers";
import { LandingPageView } from "../components/landing/landing-page-view";
import { uiLangRuAz } from "../lib/i18n/ui-lang";

async function resolveLandingLocale(): Promise<"az" | "ru"> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("erafinance_i18n_lang")?.value;
  if (fromCookie) return uiLangRuAz(fromCookie);
  return "az";
}

/** Public marketing landing: hero + bento trial offer (copy from `@erafinance/i18n/landing-copy`). */
export default async function LandingPage() {
  const locale = await resolveLandingLocale();

  return <LandingPageView initialLocale={locale} />;
}
