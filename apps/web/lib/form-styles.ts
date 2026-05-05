/** Shared form field classes — DESIGN.md § Form Elements (`rounded-lg`, `#D5DADF`, `h-9`, `text-[13px]`). */
export const FORM_INPUT_CLASS =
  "mt-1 block w-full box-border h-9 min-h-9 rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] leading-normal text-[#34495E] shadow-sm placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7] disabled:text-[#7F8C8D]";

export const FORM_TEXTAREA_CLASS =
  "mt-1 block w-full min-h-[72px] rounded-lg border border-[#D5DADF] bg-white px-3 py-2 text-[13px] leading-normal text-[#34495E] shadow-sm placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7] disabled:text-[#7F8C8D]";

export const FORM_LABEL_CLASS =
  "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

/** Month picker in `PageHeader.actions`: same 32px height as toolbar buttons, `rounded-lg` (DESIGN.md). */
export const TOOLBAR_MONTH_INPUT_CLASS =
  "h-8 min-h-8 w-auto min-w-[9.5rem] shrink-0 rounded-lg border border-[#D5DADF] bg-white px-2 text-[13px] text-slate-900 shadow-sm outline-none focus:border-[#2980B9] focus:ring-1 focus:ring-[#2980B9]/30 disabled:opacity-50";
