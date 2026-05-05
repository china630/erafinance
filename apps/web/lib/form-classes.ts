/** Unified field look (Tailwind) — DESIGN.md § Form Elements (`rounded-lg`, `#D5DADF`, `ring-1` `#2980B9`). */
export const inputFieldClass =
  "w-full max-w-md box-border h-9 min-h-9 rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] text-[#34495E] shadow-sm placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7] disabled:text-[#7F8C8D]";

/** Same styling without fixed width — for `flex` rows (VÖEN + button, etc.). */
export const inputFieldInlineClass =
  "min-w-0 flex-1 box-border h-9 min-h-9 rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] text-[#34495E] shadow-sm placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7] disabled:text-[#7F8C8D]";

/** VÖEN (10 digits) beside a button: narrow field + `tabular-nums`. */
export const inputFieldTaxIdClass =
  "w-[11ch] min-w-[9.5rem] shrink-0 box-border h-9 min-h-9 rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] tabular-nums text-[#34495E] shadow-sm placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7] disabled:text-[#7F8C8D]";

export const inputFieldWideClass =
  "w-full max-w-xl min-w-[min(100%,16rem)] box-border h-9 min-h-9 rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] text-[#34495E] shadow-sm placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7] disabled:text-[#7F8C8D]";

export const textareaFieldClass =
  "w-full min-h-[4.5rem] rounded-lg border border-[#D5DADF] bg-white px-3 py-2 text-[13px] font-mono text-[#34495E] shadow-sm placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7] disabled:text-[#7F8C8D]";
