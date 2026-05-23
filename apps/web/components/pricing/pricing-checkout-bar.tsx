import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";

export function PricingCheckoutBar({
  dueTodayLabel,
  postpaidLabel,
  bakuNotice,
}: {
  dueTodayLabel: string;
  postpaidLabel: string;
  bakuNotice: PricingStorefrontView["calculator"]["bakuNotice"];
}) {
  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700/80 bg-slate-950/95 px-4 py-3 text-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md"
      aria-label="Pricing summary"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="m-0 text-[13px] font-semibold tabular-nums">{dueTodayLabel}</p>
          <p className="m-0 text-[13px] font-medium tabular-nums text-slate-300">
            {postpaidLabel}
          </p>
        </div>
        <p className="m-0 max-w-xl text-[11px] leading-snug text-slate-400 md:text-right">
          {bakuNotice}
        </p>
      </div>
    </aside>
  );
}
