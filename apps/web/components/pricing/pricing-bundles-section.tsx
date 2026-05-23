import Link from "next/link";
import { Package, Sparkles } from "lucide-react";
import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";
import { PRICING_CARD_HOVER_CLASS, PRICING_PRIMARY_CTA_CLASS } from "../../lib/landing-motion";

function fmtAzn(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN`;
}

function moduleChips(moduleLine: string): string[] {
  return moduleLine
    .split(/[,;•|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function PricingBundlesSection({
  title,
  hint,
  bundles,
  bundleCtaLabel,
  bundlePopularBadge,
  perMonthSuffix,
  selectedBundleId,
  onSelectBundle,
}: {
  title: string;
  hint: string;
  bundles: PricingStorefrontView["bundles"];
  bundleCtaLabel: string;
  bundlePopularBadge: string;
  perMonthSuffix: string;
  selectedBundleId: string | null;
  onSelectBundle: (id: string | null) => void;
}) {
  if (bundles.length === 0) return null;

  const featuredIndex = bundles.length >= 3 ? 1 : 0;

  return (
    <section className="px-4 pb-10" aria-labelledby="pricing-bundles-title">
      <div className="mx-auto max-w-6xl">
        <h2
          id="pricing-bundles-title"
          className="m-0 text-center text-lg font-bold tracking-tight text-slate-800 md:text-xl"
        >
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[13px] leading-relaxed text-slate-600">
          {hint}
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-3 lg:items-stretch">
          {bundles.map((bundle, index) => {
            const selected = selectedBundleId === bundle.marketingId;
            const featured = index === featuredIndex;
            const chips = moduleChips(bundle.moduleLine);

            return (
              <article
                key={bundle.marketingId}
                className={[
                  "relative flex h-full flex-col overflow-hidden rounded-2xl",
                  "border bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]",
                  PRICING_CARD_HOVER_CLASS,
                  featured
                    ? "border-[#2980B9]/45 ring-2 ring-[#2980B9]/20 lg:-translate-y-1 lg:shadow-[0_16px_40px_rgba(41,128,185,0.12)]"
                    : "border-slate-200/90",
                  selected ? "ring-2 ring-[#2980B9]/55" : "",
                ].join(" ")}
              >
                <div
                  className={[
                    "h-1.5 w-full shrink-0",
                    featured
                      ? "bg-gradient-to-r from-[#2980B9] via-[#5dade2] to-teal-400"
                      : "bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300",
                  ].join(" ")}
                  aria-hidden
                />

                <div className="flex flex-1 flex-col p-5 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                        featured
                          ? "bg-[#EBF5FB] text-[#1a5276]"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      <Package className="h-3 w-3 shrink-0" aria-hidden />
                      {bundle.discountBadge}
                    </span>
                    {featured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/80">
                        <Sparkles className="h-3 w-3" aria-hidden />
                        {bundlePopularBadge}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-4 m-0 text-[18px] font-bold leading-snug text-slate-800">
                    {bundle.name}
                  </h3>

                  {chips.length > 1 ? (
                    <ul className="mt-3 flex list-none flex-wrap gap-1.5 p-0">
                      {chips.map((chip) => (
                        <li key={chip}>
                          <span className="inline-block rounded-lg border border-slate-200/90 bg-slate-50 px-2 py-1 text-[11px] font-medium leading-tight text-slate-600">
                            {chip}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 m-0 text-[13px] leading-relaxed text-slate-600">
                      {bundle.moduleLine}
                    </p>
                  )}

                  <div
                    className={[
                      "mt-5 rounded-xl border px-4 py-3.5",
                      featured
                        ? "border-[#2980B9]/15 bg-gradient-to-br from-[#EBF5FB]/80 to-white"
                        : "border-slate-100 bg-slate-50/90",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-end gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-medium text-slate-400 line-through tabular-nums">
                        {fmtAzn(bundle.listPriceAzn)}
                      </span>
                      <span className="text-[26px] font-bold tabular-nums leading-none tracking-tight text-slate-900">
                        {fmtAzn(bundle.discountedPriceAzn)}
                      </span>
                      <span className="pb-1 text-[12px] font-semibold text-slate-500">
                        {perMonthSuffix}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={bundle.ctaHref}
                    onClick={() =>
                      onSelectBundle(selected ? null : bundle.marketingId)
                    }
                    className={[
                      PRICING_PRIMARY_CTA_CLASS,
                      "mt-auto !h-11 !text-[13px]",
                      featured ? "!shadow-md" : "",
                    ].join(" ")}
                  >
                    {bundleCtaLabel}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
