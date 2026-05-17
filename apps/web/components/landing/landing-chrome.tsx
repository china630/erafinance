"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../app/language-switcher";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../lib/design-system";

export function LandingChrome() {
  const { t } = useTranslation();

  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6">
      <Link href="/" className="text-lg font-semibold text-[#34495E] no-underline">
        ERA Finance
      </Link>
      <nav className="flex flex-wrap items-center gap-3">
        <Link href="/pricing" className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
          {t("landing.navPricing")}
        </Link>
        <Link href="/login" className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
          {t("nav.login")}
        </Link>
        <Link href="/register-org" className={`${PRIMARY_BUTTON_CLASS} text-xs no-underline`}>
          {t("landing.ctaRegister")}
        </Link>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
