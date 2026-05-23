import { AlertTriangle, CheckCircle2, Factory } from "lucide-react";
import { LANDING_CARD_HOVER_CLASS } from "../../lib/landing-motion";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";

const MOCK_PANEL = `rounded-2xl border border-[#D5DADF] bg-white p-4 shadow-md ring-1 ring-slate-900/5 ${LANDING_CARD_HOVER_CLASS}`;

export function BankStatementMock({
  copy,
}: {
  copy: LandingMarketingCopy["mocks"]["finance"];
}) {
  return (
    <div className={`${MOCK_PANEL} w-full`}>
      <p className="m-0 text-[12px] font-semibold text-[#34495E]">{copy.panelTitle}</p>
      <div className="mt-3 overflow-hidden rounded-lg border border-[#D5DADF]">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#F4F5F7] text-[#7F8C8D]">
            <tr>
              <th className="px-3 py-2 font-medium">{copy.colDate}</th>
              <th className="px-3 py-2 font-medium">{copy.colDescription}</th>
              <th className="px-3 py-2 text-right font-medium">{copy.colAmount}</th>
              <th className="px-3 py-2 font-medium">{copy.colStatus}</th>
            </tr>
          </thead>
          <tbody className="text-[#34495E]">
            {copy.rows.map((row) => (
              <tr key={`${row.date}-${row.description}`} className="border-t border-[#D5DADF]/70">
                <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                <td className="px-3 py-2">{row.description}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{row.amount}</td>
                <td className="px-3 py-2">
                  {row.status === "matched" ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      {copy.matched}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      {copy.pending}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ManufacturingOrderMock({
  copy,
}: {
  copy: LandingMarketingCopy["mocks"]["manufacturing"];
}) {
  return (
    <div className={`${MOCK_PANEL} w-full`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[12px] font-semibold text-[#34495E]">{copy.panelTitle}</p>
          <p className="mt-1 text-[13px] font-semibold text-[#2980B9]">{copy.orderId}</p>
        </div>
        <Factory className="h-5 w-5 text-indigo-500" aria-hidden />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
          {copy.statusLabel}
        </span>
        <span className="text-[12px] text-[#7F8C8D]">{copy.progress}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EBEDF0]">
        <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#2980B9] to-indigo-500" />
      </div>
      <p className="mt-3 text-[11px] text-[#7F8C8D]">{copy.accountFlow}</p>
    </div>
  );
}

export function TaxLimitWidgetMock({
  copy,
}: {
  copy: LandingMarketingCopy["mocks"]["tax"];
}) {
  const pct = 95.25;
  return (
    <div className={`${MOCK_PANEL} w-full border-amber-200/80`}>
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[12px] font-semibold text-[#34495E]">{copy.panelTitle}</p>
        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
      </div>
      <p className="mt-3 text-[11px] font-medium text-amber-700">{copy.warning}</p>
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="m-0 text-[11px] text-[#7F8C8D]">{copy.ytdLabel}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-[#34495E]">{copy.amount}</p>
          </div>
          <div className="text-right">
            <p className="m-0 text-[11px] text-[#7F8C8D]">{copy.limitLabel}</p>
            <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#7F8C8D]">{copy.limit}</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#EBEDF0]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
