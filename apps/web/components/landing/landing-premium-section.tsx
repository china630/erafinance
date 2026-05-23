import { Brain, Globe2, Shield } from "lucide-react";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";

const ICONS: Record<string, typeof Shield> = {
  compliance_pro: Brain,
  tax_pro: Shield,
  trade_pro: Globe2,
};

export function LandingPremiumSection({ copy }: { copy: LandingMarketingCopy["premium"] }) {
  return (
    <section className="relative px-4 py-16 md:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-64 -translate-y-1/2 bg-gradient-to-r from-indigo-500/5 via-violet-500/10 to-indigo-500/5 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="m-0 text-2xl font-bold text-[#34495E] md:text-3xl">{copy.title}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#7F8C8D]">{copy.subtitle}</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {copy.items.map((item) => {
            const Icon = ICONS[item.slug] ?? Shield;
            return (
              <article
                key={item.slug}
                className="rounded-2xl border-2 border-indigo-200/80 bg-gradient-to-b from-white to-indigo-50/40 p-5 shadow-sm ring-1 ring-indigo-950/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex rounded-lg bg-indigo-100 p-2 text-indigo-700">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="rounded-md border border-indigo-200 bg-indigo-50/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
                    {copy.plugInBadge}
                  </span>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold leading-snug text-[#34495E]">{item.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#7F8C8D]">{item.description}</p>
                <ul className="mt-4 flex flex-wrap gap-2 p-0 list-none">
                  {item.highlights.map((h) => (
                    <li
                      key={h}
                      className="rounded-md bg-violet-100/80 px-2 py-1 text-[11px] font-medium text-violet-900"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
