import { Check } from "lucide-react";
import { LANDING_CARD_HOVER_CLASS } from "../../lib/landing-motion";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";

export function LandingTrialBanner({ copy }: { copy: LandingMarketingCopy["trial"] }) {
  return (
    <section className="px-4 py-6 md:py-8" aria-labelledby="landing-trial-offer">
      <div
        className={`relative mx-auto max-w-6xl overflow-hidden rounded-2xl border-2 border-indigo-500/30 bg-slate-950/95 p-6 shadow-xl backdrop-blur-xl dark:bg-slate-900/90 md:p-8 ${LANDING_CARD_HOVER_CLASS}`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.22),transparent_60%)]" />
        <span className="absolute right-4 top-4 z-10 rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-indigo-500/30">
          {copy.cornerBadge}
        </span>
        <div className="relative z-[1] grid gap-8 md:grid-cols-2 md:gap-10 md:pr-40">
          <div>
            <h2
              id="landing-trial-offer"
              className="m-0 text-3xl font-bold leading-none tracking-tight text-white md:text-4xl lg:text-[2.75rem]"
            >
              {copy.offerPrimary}
            </h2>
            <p className="mt-2 text-[14px] font-medium leading-snug tracking-tight text-slate-300">{copy.offerSubline}</p>
          </div>
          <div className="flex flex-col">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{copy.checklistTitle}</p>
            <ul className="mt-3 space-y-2.5 p-0 list-none">
              {copy.checklist.map((item) => (
                <li key={item} className="flex gap-2.5 text-[13px] leading-snug text-slate-200">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.5} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 pb-1 text-[11px] leading-relaxed text-slate-400">{copy.disclaimer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
