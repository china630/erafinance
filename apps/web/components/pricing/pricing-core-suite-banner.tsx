import Link from "next/link";
import type { PricingPostpaidCopy } from "../../lib/i18n/pricing-postpaid-copy";
import { PRIMARY_BUTTON_CLASS } from "../../lib/design-system";
import { PRICING_CARD_HOVER_CLASS } from "../../lib/landing-motion";

export function PricingCoreSuiteBanner({
  title,
  coreSuite,
  ctaRegister,
}: {
  title: string;
  coreSuite: PricingPostpaidCopy["coreSuite"];
  ctaRegister: string;
}) {
  return (
    <section className="px-4 pt-8 pb-4" aria-labelledby="pricing-page-title">
      <div className="mx-auto max-w-6xl">
        <h1
          id="pricing-page-title"
          className="m-0 text-center text-2xl font-bold tracking-tight text-[#34495E] md:text-3xl"
        >
          {title}
        </h1>

        <article className={`mb-6 mt-6 p-5 md:p-6 ${PRICING_CARD_HOVER_CLASS}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                <p className="m-0 text-3xl font-bold tabular-nums tracking-tight text-[#34495E] md:text-4xl">
                  {coreSuite.trialPrice}
                </p>
                <span className="inline-flex rounded-md border border-[#2980B9]/30 bg-[#2980B9]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#2980B9]">
                  {coreSuite.trialBadge}
                </span>
              </div>
              <p className="mt-3 m-0 text-[15px] font-semibold leading-snug text-[#34495E]">
                {coreSuite.postTrialPriceLine}
              </p>
              <p className="mt-2 m-0 text-[13px] leading-relaxed text-[#7F8C8D]">{coreSuite.body}</p>
              <ul className="mt-3 grid list-none gap-1.5 p-0 sm:grid-cols-2">
                {coreSuite.bullets.map((item) => (
                  <li key={item} className="flex gap-2 text-[12px] leading-snug text-slate-700">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2980B9]"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/register-org"
              className={`${PRIMARY_BUTTON_CLASS} h-10 min-h-10 shrink-0 self-start px-5 text-sm no-underline md:mt-1`}
            >
              {ctaRegister}
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}



