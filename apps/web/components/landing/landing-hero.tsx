import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { SECONDARY_BUTTON_CLASS } from "../../lib/design-system";

const HERO_CTA_CLASS =
  "relative inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2980B9] px-6 text-sm font-semibold text-white shadow-lg shadow-[#2980B9]/35 no-underline transition hover:bg-[#2471A3] focus:outline-none focus:ring-2 focus:ring-[#2980B9] focus:ring-offset-2";

export function LandingHero({ copy }: { copy: LandingMarketingCopy["hero"] }) {
  return (
    <section className="relative px-4 pb-4 pt-6 md:pb-6 md:pt-10">
      <div className="mx-auto max-w-6xl text-center">
        <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
          <span className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 bg-clip-text text-transparent">
            {copy.title}
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg font-medium leading-relaxed tracking-wide text-slate-700 subpixel-antialiased md:text-xl">
          {copy.subtitle}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/register-org" className={`${HERO_CTA_CLASS} group`}>
              <span
                aria-hidden
                className="absolute -inset-1 rounded-lg bg-[#2980B9]/40 opacity-75 blur-md motion-safe:animate-pulse"
              />
              <span className="relative flex items-center gap-2">
                {copy.ctaPrimary}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
            <Link href="/pricing" className={`${SECONDARY_BUTTON_CLASS} h-11 px-5 text-sm no-underline`}>
              {copy.ctaSecondary}
            </Link>
          </div>
          <p className="m-0 max-w-md text-center text-[11px] font-medium leading-snug tracking-tight text-[#7F8C8D]">
            {copy.ctaMicrocopy}
          </p>
        </div>
      </div>
    </section>
  );
}
