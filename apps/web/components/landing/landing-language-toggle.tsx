"use client";

import { uiLangRuAz } from "../../lib/i18n/ui-lang";

const COOKIE = "erafinance_i18n_lang";

function setLocaleCookie(locale: "ru" | "az") {
  document.cookie = `${COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
  try {
    localStorage.setItem(COOKIE, locale);
  } catch {
    /* ignore */
  }
}

export function LandingLanguageToggle({
  locale,
  onLocaleChange,
}: {
  locale: "ru" | "az";
  onLocaleChange?: (next: "ru" | "az") => void;
}) {
  const switchTo = (next: "ru" | "az") => {
    const normalized = uiLangRuAz(next);
    if (normalized === locale) return;
    setLocaleCookie(normalized);
    onLocaleChange?.(normalized);
  };

  return (
    <div role="group" aria-label="Language" className="inline-flex items-center gap-1 rounded-lg border border-[#D5DADF] bg-white p-0.5">
      {(["az", "ru"] as const).map((lng) => {
        const active = locale === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => switchTo(lng)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
              active
                ? "bg-[#2980B9] text-white shadow-sm"
                : "text-[#7F8C8D] hover:bg-[#F4F5F7] hover:text-[#34495E]"
            }`}
            aria-pressed={active}
          >
            {lng}
          </button>
        );
      })}
    </div>
  );
}
