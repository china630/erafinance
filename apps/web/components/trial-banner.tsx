"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { az as azLocale, ru as ruLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { LINK_ACCENT_CLASS } from "../lib/design-system";
import { uiLangRuAz } from "../lib/i18n/ui-lang";
import { useSubscription } from "../lib/subscription-context";

function displayLocale(lang: string) {
  return uiLangRuAz(lang) === "ru" ? ruLocale : azLocale;
}

function firstDayOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function formatBannerDate(date: Date, lang: string): string {
  return format(date, "d MMMM", { locale: displayLocale(lang) });
}

function isNextCalendarMonth(after: Date, before: Date): boolean {
  const diff =
    (after.getFullYear() - before.getFullYear()) * 12 +
    (after.getMonth() - before.getMonth());
  return diff === 1;
}

export function TrialBanner() {
  const { t, i18n } = useTranslation();
  const { ready, effectiveSnapshot: snapshot } = useSubscription();

  if (!ready || !snapshot) return null;

  const now = new Date();
  const expiresAt = snapshot.expiresAt ? parseISO(snapshot.expiresAt) : null;
  const expiresAtMs = expiresAt?.getTime() ?? null;
  const hasExpired = expiresAtMs != null && expiresAtMs < now.getTime();
  const hasFutureTrial =
    Boolean(snapshot.isTrial) && expiresAtMs != null && expiresAtMs > now.getTime();
  const showPostpaidFirstInvoice =
    !snapshot.isTrial &&
    hasExpired &&
    snapshot.billingStatus === "ACTIVE" &&
    expiresAt != null &&
    isNextCalendarMonth(now, expiresAt);

  if (hasFutureTrial && expiresAt) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        {t("trialBanner.demoUntilPaidStart", {
          date: formatBannerDate(firstDayOfNextMonth(expiresAt), i18n.language),
        })}
      </div>
    );
  }

  if (showPostpaidFirstInvoice) {
    return (
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-900">
        {t("trialBanner.postpaidFirstInvoiceAt", {
          date: formatBannerDate(firstDayOfNextMonth(now), i18n.language),
        })}
      </div>
    );
  }

  if (snapshot.readOnly) {
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
        <div className="font-semibold">{t("trialBanner.readOnlyTitle")}</div>
        <div className="mt-1 text-red-700">{t("trialBanner.readOnlyBody")}</div>
        <Link href="/settings/subscription" className={`${LINK_ACCENT_CLASS} mt-2 inline-flex`}>
          {t("trialBanner.readOnlyCta")}
        </Link>
      </div>
    );
  }

  return null;
}
