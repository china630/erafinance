"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../language-switcher";
import { PublicLegalFooter } from "../../components/public-legal-footer";
import {
  CARD_CONTAINER_CLASS,
  LINK_ACCENT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";
import { pricingModuleLabel } from "../../lib/pricing-module-label";
import { publicApiFetch } from "../../lib/public-api-fetch";
import type { PublicPricingResponse } from "../../lib/public-pricing-types";

const TIER_ORDER = ["STARTER", "BUSINESS", "ENTERPRISE"] as const;

function formatAzn(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} AZN`;
}

function quotaCell(v: number | null | undefined, tUnlimited: string): string {
  if (v === null || v === undefined) return tUnlimited;
  return String(v);
}

export default function PublicPricingPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<PublicPricingResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await publicApiFetch("/api/public/pricing");
        if (!res.ok) {
          if (!cancelled) setErr(`${res.status}`);
          return;
        }
        const json = (await res.json()) as PublicPricingResponse;
        if (!cancelled) {
          setData(json);
          setErr(null);
        }
      } catch {
        if (!cancelled) setErr("network");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modulesSorted = data?.pricingModules
    ? [...data.pricingModules].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return (
    <main className="min-h-screen bg-[#EBEDF0] px-4 py-10">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-[#34495E] md:text-3xl">
            {t("pricingPage.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-[#7F8C8D]">
            {t("pricingPage.intro")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/register-org" className={`${PRIMARY_BUTTON_CLASS} no-underline`}>
              {t("pricingPage.ctaRegisterOrg")}
            </Link>
            <Link href="/register" className={`${SECONDARY_BUTTON_CLASS} no-underline`}>
              {t("pricingPage.ctaRegisterUser")}
            </Link>
            <Link href="/login" className={`${SECONDARY_BUTTON_CLASS} no-underline`}>
              {t("nav.login")}
            </Link>
          </div>
        </header>

        {err ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[13px] text-amber-900">
            {t("pricingPage.loadErr")}
          </p>
        ) : null}

        {data?.unavailable ? (
          <p className="rounded-2xl border border-[#D5DADF] bg-white px-4 py-3 text-center text-[13px] text-[#7F8C8D]">
            {t("pricingPage.partialData")}
          </p>
        ) : null}

        {data ? (
          <>
            <section className={`${CARD_CONTAINER_CLASS} p-6`}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
                {t("pricingPage.foundationTitle")}
              </h2>
              <p className="mt-2 text-[13px] text-[#7F8C8D]">{t("pricingPage.foundationHint")}</p>
              <p className="mt-4 text-lg font-semibold tabular-nums text-[#34495E]">
                {formatAzn(data.foundationMonthlyAzn)}{" "}
                <span className="text-[13px] font-normal text-[#7F8C8D]">
                  / {t("pricingPage.perMonth")}
                </span>
              </p>
              <p className="mt-3 text-[13px] text-[#7F8C8D]">
                {t("pricingPage.yearlyDiscount", { pct: data.yearlyDiscountPercent })}
              </p>
            </section>

            <section className={`${CARD_CONTAINER_CLASS} p-6`}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
                {t("pricingPage.modulesTitle")}
              </h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-[#D5DADF]">
                <table className="min-w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#D5DADF] bg-[#F8F9FA]">
                      <th className="px-4 py-2 font-semibold text-[#34495E]">
                        {t("pricingPage.colModule")}
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-[#34495E]">
                        {t("pricingPage.colPriceMonth")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modulesSorted.map((m) => (
                      <tr key={m.key} className="border-b border-[#EBEDF0] last:border-0">
                        <td className="px-4 py-2 text-[#34495E]">
                          <span className="font-medium">
                            {pricingModuleLabel(m.key, m.name, t)}
                          </span>
                          <span className="ml-2 font-mono text-[#7F8C8D]">{m.key}</span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#34495E]">
                          {formatAzn(m.pricePerMonth)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {data.pricingBundles.length > 0 ? (
              <section className={`${CARD_CONTAINER_CLASS} p-6`}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
                  {t("pricingPage.bundlesTitle")}
                </h2>
                <ul className="mt-4 space-y-3">
                  {data.pricingBundles.map((b, i) => (
                    <li
                      key={`${b.name}-${i}`}
                      className={`rounded-2xl border p-4 ${
                        b.isTrialDefault
                          ? "border-[#2980B9] ring-2 ring-[#2980B9]/20"
                          : "border-[#D5DADF]"
                      } bg-white`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#34495E]">{b.name}</span>
                        {b.isTrialDefault ? (
                          <span className="rounded-md border border-[#2980B9] bg-[#EBEDF0] px-2 py-0.5 text-xs font-medium text-[#2980B9]">
                            {t("pricingPage.trialBadge")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] text-[#7F8C8D]">
                        {t("pricingPage.bundleDiscount", { pct: b.discountPercent })}
                        {b.trialDurationDays != null
                          ? ` · ${t("pricingPage.trialDays", { days: b.trialDurationDays })}`
                          : ""}
                      </p>
                      <p className="mt-2 font-mono text-xs text-[#7F8C8D]">{b.moduleKeys.join(", ")}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className={`${CARD_CONTAINER_CLASS} p-6`}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
                {t("pricingPage.tiersTitle")}
              </h2>
              <p className="mt-2 text-[13px] text-[#7F8C8D]">{t("pricingPage.tiersHint")}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {TIER_ORDER.map((tier) => {
                  const q = data.tierQuotasIncluded[tier];
                  const legacy = data.tierLegacyPricePerMonthAzn[tier];
                  return (
                    <div
                      key={tier}
                      className="rounded-2xl border border-[#D5DADF] bg-[#F8F9FA] p-4 text-[13px]"
                    >
                      <div className="font-bold text-[#34495E]">{tier}</div>
                      {legacy != null && Number.isFinite(legacy) ? (
                        <div className="mt-2 tabular-nums text-[#34495E]">
                          {t("pricingPage.legacyTierLine")}: {formatAzn(legacy)}
                        </div>
                      ) : null}
                      {q ? (
                        <dl className="mt-3 space-y-1.5 text-[#34495E]">
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#7F8C8D]">{t("pricingPage.qEmployees")}</dt>
                            <dd className="tabular-nums font-medium">
                              {quotaCell(q.maxEmployees, t("pricingPage.unlimited"))}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#7F8C8D]">{t("pricingPage.qInvoices")}</dt>
                            <dd className="tabular-nums font-medium">
                              {quotaCell(q.maxInvoicesPerMonth, t("pricingPage.unlimited"))}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#7F8C8D]">{t("pricingPage.qStorage")}</dt>
                            <dd className="tabular-nums font-medium">
                              {quotaCell(q.maxStorageGb, t("pricingPage.unlimited"))}
                            </dd>
                          </div>
                        </dl>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            {data.quotaUnitPricing != null ? (
              <section className={`${CARD_CONTAINER_CLASS} p-6`}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#34495E]">
                  {t("pricingPage.overlimitTitle")}
                </h2>
                <p className="mt-2 text-[13px] text-[#7F8C8D]">{t("pricingPage.overlimitHint")}</p>
                <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-[#D5DADF] bg-white p-3 text-xs text-[#34495E]">
                  {JSON.stringify(data.quotaUnitPricing, null, 2)}
                </pre>
              </section>
            ) : null}

            {data.ocrJobsPerOrgMonth != null ? (
              <p className="text-center text-[13px] text-[#7F8C8D]">
                {t("pricingPage.ocrLimit", { n: data.ocrJobsPerOrgMonth })}
              </p>
            ) : null}
          </>
        ) : !err ? (
          <p className="text-center text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
        ) : null}

        <p className="text-center text-[13px] text-[#7F8C8D]">
          <Link href="/help" className={LINK_ACCENT_CLASS}>
            {t("pricingPage.backHelp")}
          </Link>
        </p>

        <PublicLegalFooter />
      </div>
    </main>
  );
}
