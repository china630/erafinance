"use client";

import Link from "next/link";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../lib/design-system";
import { LandingLanguageToggle } from "./landing-language-toggle";

export function LandingChrome({
  hero,
  loginLabel,
  locale,
  onLocaleChange,
}: {
  hero: LandingMarketingCopy["hero"];
  loginLabel: string;
  locale: "ru" | "az";
  onLocaleChange?: (next: "ru" | "az") => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#D5DADF]/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-[#34495E] no-underline">
          ERA Finance
        </Link>
        <nav className="flex flex-wrap items-center gap-2 md:gap-3">
          <LandingLanguageToggle locale={locale} onLocaleChange={onLocaleChange} />
          <Link href="/pricing" className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
            {hero.navPricing}
          </Link>
          <Link href="/login" className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
            {loginLabel}
          </Link>
          <Link href="/register-org" className={`${PRIMARY_BUTTON_CLASS} text-xs no-underline`}>
            {hero.ctaPrimary}
          </Link>
        </nav>
      </div>
    </header>
  );
}
