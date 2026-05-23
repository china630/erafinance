import Link from "next/link";
import { LANDING_CARD_HOVER_CLASS } from "../../lib/landing-motion";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { PRIMARY_BUTTON_CLASS } from "../../lib/design-system";

const BOTTOM_CTA_SECONDARY_CLASS =
  "inline-flex h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900 px-6 text-sm font-semibold text-slate-100 shadow-sm no-underline transition-all duration-200 hover:bg-slate-800/80 hover:text-white";

export function LandingBottomCta({ copy }: { copy: LandingMarketingCopy["bottomCta"] }) {
  return (
    <section className="px-4 pb-12 pt-4 md:pb-16" aria-labelledby="landing-bottom-cta-headline">
      <div
        className={`relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/95 p-8 text-center shadow-lg backdrop-blur-xl md:p-10 ${LANDING_CARD_HOVER_CLASS}`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(41,128,185,0.15),transparent_70%)]"
        />
        <div className="relative">
          <h2
            id="landing-bottom-cta-headline"
            className="m-0 text-2xl font-bold tracking-tight text-white md:text-3xl"
          >
            {copy.headline}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-snug text-slate-300">{copy.subtext}</p>
          <div className="mt-7 flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register-org" className={`${PRIMARY_BUTTON_CLASS} h-11 px-6 text-sm no-underline`}>
                {copy.primary}
              </Link>
              <Link href="/login" className={BOTTOM_CTA_SECONDARY_CLASS}>
                {copy.secondary}
              </Link>
            </div>
            <p className="m-0 max-w-md text-center text-[11px] font-medium leading-snug tracking-tight text-slate-400">
              {copy.ctaMicrocopy}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
