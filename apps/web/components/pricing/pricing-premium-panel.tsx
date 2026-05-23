import Link from "next/link";
import { Check } from "lucide-react";
import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";

export function PricingPremiumPanel({
  title,
  hint,
  premiumModules,
  premiumLockedTitle,
  premiumUpgradeCta,
  selectedPremiumSlugs,
  onTogglePremium,
}: {
  title: string;
  hint: string;
  premiumModules: PricingStorefrontView["premiumModules"];
  premiumLockedTitle: string;
  premiumUpgradeCta: string;
  selectedPremiumSlugs: readonly string[];
  onTogglePremium: (slug: string) => void;
}) {
  return (
    <section className="px-4 pb-12" aria-labelledby="pricing-premium-title">
      <div className="mx-auto max-w-6xl">
        <h2
          id="pricing-premium-title"
          className="m-0 text-lg font-bold tracking-tight text-slate-800 md:text-xl"
        >
          {title}
        </h2>
        <p className="mt-1.5 m-0 max-w-2xl text-[13px] leading-relaxed text-slate-600">
          {hint}
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {premiumModules.map((mod) => {
            const checked = selectedPremiumSlugs.includes(mod.slug);
            return (
              <article
                key={mod.slug}
                className={`flex min-h-[18rem] flex-col rounded-2xl bg-slate-950 p-6 text-slate-100 shadow-lg ${
                  checked ? "ring-2 ring-[#2980B9]/60" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-[#2980B9] focus:ring-[#2980B9]/40"
                      checked={checked}
                      onChange={() => onTogglePremium(mod.slug)}
                    />
                    <h3 className="m-0 text-[16px] font-bold leading-snug">{mod.name}</h3>
                  </label>
                  <p className="m-0 shrink-0 text-[14px] font-bold tabular-nums text-slate-200">
                    {mod.priceLabel}
                  </p>
                </div>

                {mod.description ? (
                  <p className="mt-3 m-0 text-[13px] leading-snug text-slate-400">
                    {mod.description}
                  </p>
                ) : null}

                <ul className="mt-4 flex-1 list-none space-y-2.5 p-0">
                  {mod.bullets.map((item) => (
                    <li key={item} className="flex gap-2 text-[13px] leading-snug text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2980B9]" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative mt-5">
                  <Link
                    href="/register-org?tier=TIER_1"
                    className="pointer-events-none inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-800 text-sm font-semibold text-slate-100 no-underline opacity-40"
                    tabIndex={-1}
                    aria-hidden
                  >
                    {premiumUpgradeCta}
                  </Link>
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-3 backdrop-blur-md">
                    <p className="m-0 text-center text-[11px] font-semibold leading-snug text-slate-100">
                      {premiumLockedTitle}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
