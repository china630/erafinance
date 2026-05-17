"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../language-switcher";
import { LINK_ACCENT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../lib/design-system";
import { PublicLegalFooter } from "../../components/public-legal-footer";

export default function HelpPage() {
  const { t } = useTranslation();
  const docs = process.env.NEXT_PUBLIC_ERAFINANCE_DOCS_URL?.trim();
  const video = process.env.NEXT_PUBLIC_ERAFINANCE_VIDEO_URL?.trim();

  return (
    <main className="min-h-screen bg-[#EBEDF0] flex flex-col items-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm border border-[#D5DADF]">
        <h1 className="text-xl font-semibold text-gray-900">{t("help.title")}</h1>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">{t("help.intro")}</p>

        <section className="mt-6 space-y-4 text-sm text-gray-800">
          <div>
            <h2 className="font-medium text-gray-900">{t("help.asanTitle")}</h2>
            <p className="mt-1.5 text-gray-600 leading-relaxed whitespace-pre-line">{t("help.asanBody")}</p>
          </div>
          <div>
            <h2 className="font-medium text-gray-900">{t("help.firstStepsTitle")}</h2>
            <p className="mt-1.5 text-gray-600 leading-relaxed whitespace-pre-line">{t("help.firstStepsBody")}</p>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href="/login" className={`${PRIMARY_BUTTON_CLASS} text-center no-underline`}>
            {t("help.backLogin")}
          </Link>
          <Link href="/pricing" className={`${SECONDARY_BUTTON_CLASS} text-center no-underline`}>
            {t("pricingPage.title")}
          </Link>
          {docs ? (
            <a
              href={docs}
              target="_blank"
              rel="noopener noreferrer"
              className={`${SECONDARY_BUTTON_CLASS} text-center no-underline`}
            >
              {t("help.openDocs")}
            </a>
          ) : null}
          {video ? (
            <a
              href={video}
              target="_blank"
              rel="noopener noreferrer"
              className={`${LINK_ACCENT_CLASS} text-center py-2.5 text-sm font-medium`}
            >
              {t("help.openVideo")}
            </a>
          ) : null}
        </div>

        <PublicLegalFooter />
      </div>
    </main>
  );
}
