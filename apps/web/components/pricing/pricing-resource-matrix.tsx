import Link from "next/link";
import {
  FileText,
  HardDrive,
  MessageCircle,
  ScanText,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";
import { PRICING_MATRIX_ROW_CLASS } from "../../lib/landing-motion";

const GRID_CLASS = "grid grid-cols-5 gap-1.5 items-stretch";

function tierCheckoutHref(tier: PricingStorefrontView["tiers"][number]): string {
  if (tier.id === "TIER_0") return "/register-org";
  if (tier.checkoutTier) {
    return `/register-org?tier=${encodeURIComponent(tier.checkoutTier)}`;
  }
  return "/register-org";
}

function fmtUnit(n: number): string {
  return n.toFixed(n % 1 === 0 ? 0 : 2);
}

export function PricingResourceMatrix({
  title,
  hint,
  tiers,
  unitPriceLabels,
  meterUnitPricing,
  selectedTierId,
  onSelectTier,
}: {
  title: string;
  hint: string;
  tiers: PricingStorefrontView["tiers"];
  unitPriceLabels: PricingStorefrontView["unitPriceLabels"];
  meterUnitPricing: PricingStorefrontView["meterUnitPricing"];
  selectedTierId: PricingStorefrontView["tiers"][number]["id"];
  onSelectTier: (id: PricingStorefrontView["tiers"][number]["id"]) => void;
}) {
  const unitRows: { id: string; label: string; Icon: LucideIcon; value: string }[] = [
    {
      id: "users",
      label: unitPriceLabels.users,
      Icon: Users,
      value: `${fmtUnit(meterUnitPricing.pricePerUserMonthAzn)} AZN`,
    },
    {
      id: "invoices",
      label: unitPriceLabels.invoices,
      Icon: FileText,
      value: `${fmtUnit(meterUnitPricing.pricePerInvoiceAzn)} AZN`,
    },
    {
      id: "storage",
      label: unitPriceLabels.storage,
      Icon: HardDrive,
      value: `${fmtUnit(meterUnitPricing.pricePerGbMonthAzn)} AZN`,
    },
    {
      id: "whatsapp",
      label: unitPriceLabels.whatsapp,
      Icon: MessageCircle,
      value: `${fmtUnit(meterUnitPricing.pricePerWhatsappAlertAzn)} AZN`,
    },
    {
      id: "ocr",
      label: unitPriceLabels.ocr,
      Icon: ScanText,
      value: `${fmtUnit(meterUnitPricing.pricePerOcrPageAzn)} AZN`,
    },
  ];

  return (
    <section className="px-4 py-4" aria-labelledby="pricing-limits-title">
      <div className="mx-auto max-w-[88rem]">
        <h2
          id="pricing-limits-title"
          className="m-0 text-lg font-bold tracking-tight text-slate-800 md:text-xl"
        >
          {title}
        </h2>
        <p className="mt-1.5 m-0 max-w-4xl text-[12px] leading-relaxed text-slate-600">
          {hint}
        </p>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="min-w-[52rem]">
            <div className={`${PRICING_MATRIX_ROW_CLASS} ${GRID_CLASS} px-1 py-1`}>
              <div className="flex items-end px-3 py-1.5" aria-hidden>
                <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {unitPriceLabels.metricColumn}
                </p>
              </div>
              {tiers.map((tier) => {
                const isSelected = selectedTierId === tier.id;
                const isCurrent = tier.ctaVariant === "current";
                return (
                  <article
                    key={tier.id}
                    className={`rounded-lg border bg-white/70 py-1.5 transition-shadow ${
                      isSelected
                        ? "border-[#2980B9] ring-2 ring-[#2980B9]/30"
                        : "border-slate-200/80"
                    }`}
                  >
                    <div className="flex h-full flex-col px-3 py-1.5 text-[13px]">
                      <h3 className="m-0 text-center text-[10px] font-bold uppercase tracking-wide text-[#2980B9]">
                        {tier.columnTitle}
                      </h3>
                      <div className="mt-1 flex flex-1 flex-col items-center justify-center text-center">
                        <p className="m-0 font-bold tabular-nums leading-tight text-slate-800">
                          {tier.spendCeilingLabel}
                        </p>
                      </div>
                      <div className="mt-1.5 shrink-0">
                        {isCurrent ? (
                          <span
                            className="inline-flex h-7 w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-2 text-center text-[11px] font-semibold text-slate-600"
                            aria-current="true"
                          >
                            {tier.ctaLabel}
                          </span>
                        ) : (
                          <Link
                            href={tierCheckoutHref(tier)}
                            onClick={() => onSelectTier(tier.id)}
                            className="inline-flex h-7 w-full items-center justify-center rounded-lg bg-[#2980B9] px-2 text-center text-[11px] font-semibold text-white no-underline transition-colors hover:bg-[#216f9e]"
                          >
                            {tier.ctaLabel}
                          </Link>
                        )}
                      </div>
                      </div>
                  </article>
                );
              })}
            </div>

            <ul className="mt-1.5 list-none p-0">
              {unitRows.map((row) => {
                const Icon = row.Icon;
                return (
                  <li key={row.id} className={PRICING_MATRIX_ROW_CLASS}>
                    <div className={GRID_CLASS}>
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-white/80 text-[#2980B9]">
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="text-[13px] font-semibold leading-snug text-slate-800">
                          {row.label}
                          <span className="mt-0.5 block text-[12px] font-normal tabular-nums text-slate-600">
                            {row.value}
                          </span>
                        </span>
                      </div>
                      {tiers.map((tier) => (
                        <div
                          key={`${row.id}-${tier.id}`}
                          className="flex items-center justify-center px-3 py-1.5 text-center text-[11px] text-slate-500"
                          aria-hidden
                        >
                          —
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
