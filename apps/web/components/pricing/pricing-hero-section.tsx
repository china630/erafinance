import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";

export function PricingHeroSection({
  hero,
}: {
  hero: PricingStorefrontView["hero"];
}) {
  return (
    <section className="px-4 pt-8 pb-2" aria-labelledby="pricing-page-title">
      <div className="mx-auto max-w-6xl">
        <h1
          id="pricing-page-title"
          className="m-0 text-center text-2xl font-bold tracking-tight text-slate-800 md:text-3xl"
        >
          {hero.title}
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-center text-[15px] leading-relaxed text-slate-600">
          {hero.subtitle}
        </p>
      </div>
    </section>
  );
}
