"use client";

import { useEffect, useMemo, useState } from "react";
import { getLandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { LandingChrome } from "./landing-chrome";
import { LandingFeatureSplits } from "./landing-feature-splits";
import { LandingHero } from "./landing-hero";
import { LandingPageShell } from "./landing-page-shell";
import { LandingEcosystemGrid } from "./landing-ecosystem-grid";
import { LandingLegacyCompare } from "./landing-legacy-compare";
import { LandingTrialBanner } from "./landing-trial-banner";
import { LandingZeroKnowledge } from "./landing-zero-knowledge";
import { LandingBottomCta } from "./landing-bottom-cta";

export function LandingPageView({ initialLocale }: { initialLocale: "az" | "ru" }) {
  const [locale, setLocale] = useState(initialLocale);
  const copy = useMemo(() => getLandingMarketingCopy(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LandingPageShell>
      <LandingChrome
        hero={copy.hero}
        loginLabel={copy.chrome.login}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <main id="landing-main">
        <div className="mx-auto max-w-6xl">
          <LandingHero copy={copy.hero} />
          <LandingTrialBanner copy={copy.trial} />
        </div>
        <LandingEcosystemGrid copy={copy.ecosystem} />
        <LandingZeroKnowledge copy={copy.zeroKnowledge} />
        <LandingLegacyCompare copy={copy.legacyCompare} />
        <LandingFeatureSplits copy={copy} />
        <LandingBottomCta copy={copy.bottomCta} />
      </main>
      <footer className="border-t border-[#D5DADF]/80 px-4 py-8 text-center text-[12px] text-[#7F8C8D]">
        © {new Date().getFullYear()} {copy.footer}
      </footer>
    </LandingPageShell>
  );
}
