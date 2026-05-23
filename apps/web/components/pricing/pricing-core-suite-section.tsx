import { Check } from "lucide-react";
import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";
import { PRICING_CARD_HOVER_CLASS } from "../../lib/landing-motion";
import { PricingTrialPromoBanner } from "./pricing-trial-promo-banner";

type StandardModule = PricingStorefrontView["standardModules"][number];

function fmtPrice(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN`;
}

const CORE_MODULE_CARD_CLASS = [
  "flex min-h-[14rem] flex-col rounded-2xl p-5 md:p-6",
  "border border-slate-200/90 bg-white",
  "shadow-[0_4px_20px_rgba(15,23,42,0.05)]",
  PRICING_CARD_HOVER_CLASS,
  "hover:border-[#2980B9]/35",
].join(" ");

const FOUNDATION_CARD_CLASS = [
  "flex w-full max-w-md flex-col rounded-2xl p-6 md:p-7",
  "border border-[#2980B9]/20 bg-gradient-to-br from-[#EBF5FB]/50 via-white to-white",
  "shadow-[0_6px_24px_rgba(41,128,185,0.07)]",
  PRICING_CARD_HOVER_CLASS,
  "hover:border-[#2980B9]/40",
].join(" ");

function ModulePriceTag({
  pricePerMonthAzn,
  perMonthSuffix,
}: {
  pricePerMonthAzn: number;
  perMonthSuffix: string;
}) {
  return (
    <p className="m-0 shrink-0 whitespace-nowrap text-right text-[15px] font-bold tabular-nums leading-none">
      <span className="text-[#2980B9]">{fmtPrice(pricePerMonthAzn)}</span>
      <span className="font-semibold text-slate-500"> {perMonthSuffix}</span>
    </p>
  );
}

function ModuleCardHeading({
  name,
  subtitle,
  titleClassName = "text-[16px] md:text-[17px]",
}: {
  name: string;
  subtitle: string;
  titleClassName?: string;
}) {
  return (
    <div className="min-w-0 flex-1 pr-2">
      <h3 className={`m-0 font-bold leading-snug text-[#2C3E50] ${titleClassName}`}>{name}</h3>
      {subtitle ? (
        <p className="mt-1.5 m-0 text-[13px] leading-snug text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

function ModuleBulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-4 flex-1 list-none space-y-2 p-0">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[13px] leading-snug text-slate-600">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2980B9]" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CoreModuleCard({
  mod,
  perMonthSuffix,
  cardClassName = CORE_MODULE_CARD_CLASS,
  titleClassName = "text-[16px] md:text-[17px]",
}: {
  mod: StandardModule;
  perMonthSuffix: string;
  cardClassName?: string;
  titleClassName?: string;
}) {
  return (
    <article className={`h-full ${cardClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <ModuleCardHeading
          name={mod.name}
          subtitle={mod.subtitle}
          titleClassName={titleClassName}
        />
        <ModulePriceTag
          pricePerMonthAzn={mod.pricePerMonthAzn}
          perMonthSuffix={perMonthSuffix}
        />
      </div>
      <ModuleBulletList items={mod.bullets} />
    </article>
  );
}

export function PricingCoreSuiteSection({
  coreSuiteTitle,
  coreSuiteIntro,
  standardModulesTitle,
  foundation,
  standardModules,
  perMonthSuffix,
  trialPromoText,
  trialPromoButton,
}: {
  coreSuiteTitle: string;
  coreSuiteIntro: string;
  standardModulesTitle: string;
  foundation: PricingStorefrontView["foundation"];
  standardModules: PricingStorefrontView["standardModules"];
  perMonthSuffix: string;
  trialPromoText: string;
  trialPromoButton: string;
}) {
  const foundationModule = standardModules.find((m) => m.id === "core_accounting");
  const addonModules = standardModules.filter((m) => m.id !== "core_accounting");

  return (
    <section className="px-4 py-6" aria-labelledby="pricing-core-suite-title">
      <div className="mx-auto max-w-6xl">
        <h2
          id="pricing-core-suite-title"
          className="m-0 text-center text-lg font-bold tracking-tight text-[#2C3E50] md:text-xl"
        >
          {coreSuiteTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[14px] leading-relaxed text-slate-600">
          {coreSuiteIntro}
        </p>

        {foundationModule ? (
          <div className="mt-8 flex justify-center">
            <CoreModuleCard
              mod={foundationModule}
              perMonthSuffix={perMonthSuffix}
              cardClassName={FOUNDATION_CARD_CLASS}
              titleClassName="text-lg md:text-xl"
            />
          </div>
        ) : (
          <div className="mt-8 flex justify-center">
            <article className={FOUNDATION_CARD_CLASS}>
              <ModuleCardHeading
                name={foundation.title}
                subtitle={foundation.description}
                titleClassName="text-lg md:text-xl"
              />
            </article>
          </div>
        )}

        {addonModules.length > 0 ? (
          <>
            <h3 className="m-0 mt-12 text-center text-sm font-bold uppercase tracking-wide text-slate-500">
              {standardModulesTitle}
            </h3>
            <ul className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {addonModules.map((mod) => (
                <li key={mod.id}>
                  <CoreModuleCard mod={mod} perMonthSuffix={perMonthSuffix} />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <PricingTrialPromoBanner
          text={trialPromoText}
          buttonLabel={trialPromoButton}
          className="mt-10"
        />
      </div>
    </section>
  );
}
