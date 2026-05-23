/**
 * Shared hover physics for marketing landing cards.
 * Transform-only — no layout reflow on hover.
 */
export const LANDING_CARD_HOVER_CLASS =
  "transition-all duration-300 ease-out transform will-change-transform hover:-translate-y-1 hover:scale-[1.01] hover:border-slate-700/60 hover:shadow-[0_10px_30px_rgba(99,102,241,0.05)]";

/** Premium glass panel for pricing matrix and add-on cards. */
export const PRICING_GLASS_CARD_CLASS =
  "bg-white/70 backdrop-blur-md border border-slate-300/70 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.015)] transition-all duration-300";

/** Unified live-card hover — subtle lift (pricing storefront). */
export const PRICING_CARD_HOVER_CLASS =
  "transition-all duration-300 will-change-transform hover:-translate-y-0.5 hover:border-indigo-400/60 hover:shadow-sm";

/** Dense matrix row shell. */
export const PRICING_MATRIX_ROW_CLASS =
  "bg-white/40 border border-slate-200/60 rounded-xl mb-1.5";

/** Brand-primary CTA (matches landing / DESIGN.md #2980B9). */
export const PRICING_PRIMARY_CTA_CLASS =
  "inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#2980B9] px-3 text-center text-[12px] font-semibold text-white no-underline shadow-sm transition-all duration-300 hover:bg-[#216f9e] focus:outline-none focus:ring-2 focus:ring-[#2980B9]/40 focus:ring-offset-1";
