"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LINK_ACCENT_CLASS } from "../lib/design-system";

function trimUrl(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function PublicLegalFooter() {
  const { t } = useTranslation();
  const terms = trimUrl(process.env.NEXT_PUBLIC_ERAFINANCE_TERMS_URL);
  const privacy = trimUrl(process.env.NEXT_PUBLIC_ERAFINANCE_PRIVACY_URL);
  const status = trimUrl(process.env.NEXT_PUBLIC_ERAFINANCE_STATUS_URL);
  const docs = trimUrl(process.env.NEXT_PUBLIC_ERAFINANCE_DOCS_URL);
  const video = trimUrl(process.env.NEXT_PUBLIC_ERAFINANCE_VIDEO_URL);

  const linkClass = `${LINK_ACCENT_CLASS} whitespace-nowrap`;

  return (
    <nav
      className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-[#D5DADF] pt-4 text-xs text-gray-600"
      aria-label={t("auth.footerLegalNavAria")}
    >
      <Link href="/help" className={linkClass}>
        {t("auth.footerHelp")}
      </Link>
      {docs ? (
        <a href={docs} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {t("auth.footerDocs")}
        </a>
      ) : null}
      {video ? (
        <a href={video} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {t("auth.footerVideo")}
        </a>
      ) : null}
      {terms ? (
        <a href={terms} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {t("auth.footerTerms")}
        </a>
      ) : null}
      {privacy ? (
        <a href={privacy} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {t("auth.footerPrivacy")}
        </a>
      ) : null}
      {status ? (
        <a href={status} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {t("auth.footerStatus")}
        </a>
      ) : null}
    </nav>
  );
}
