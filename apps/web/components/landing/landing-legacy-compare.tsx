import { Check, X } from "lucide-react";
import type {
  LandingLegacyCompareCopy,
  LandingLegacyCompareRow,
} from "../../lib/i18n/landing-marketing-copy";

const ROW_SHELL =
  "group mb-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 backdrop-blur-lg transition-all duration-300 will-change-transform last:mb-0 hover:border-indigo-500/40";

function CriteriaBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-center text-[11px] font-bold uppercase tracking-widest text-indigo-300">
      {label}
    </span>
  );
}

function BattleArenaRow({ row }: { row: LandingLegacyCompareRow }) {
  return (
    <li className={ROW_SHELL}>
      <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-4">
        <div className="flex justify-center md:hidden">
          <CriteriaBadge label={row.topic} />
        </div>

        <p className="m-0 flex min-w-0 items-start gap-2.5 text-[13.5px] font-medium leading-relaxed text-slate-300/90 antialiased transition-opacity duration-300 will-change-[opacity] group-hover:opacity-30 group-hover:blur-none md:col-start-1">
          <X
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500/70 transition-colors duration-300 group-hover:text-red-500/40"
            aria-hidden
          />
          <span className="min-w-0">{row.legacy}</span>
        </p>

        <div className="hidden justify-center md:col-start-2 md:flex">
          <CriteriaBadge label={row.topic} />
        </div>

        <p className="m-0 flex min-w-0 items-start gap-2.5 text-[13.5px] font-medium leading-relaxed text-slate-50 transition-[color,transform] duration-300 will-change-transform group-hover:translate-x-1 group-hover:text-white md:col-start-3 md:justify-end">
          <Check
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400 transition-colors duration-300 group-hover:text-emerald-300"
            aria-hidden
          />
          <span className="min-w-0 md:text-right">{row.era}</span>
        </p>
      </div>
    </li>
  );
}

function ArenaHeader({
  legacyBrand,
  eraBrand,
}: {
  legacyBrand: string;
  eraBrand: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-800/40 pb-3">
      <p className="m-0 text-xs font-medium uppercase tracking-wider text-slate-500">{legacyBrand}</p>
      <p className="m-0 text-sm font-bold uppercase tracking-widest text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.25)]">
        {eraBrand}
      </p>
    </div>
  );
}

export function LandingLegacyCompare({ copy }: { copy: LandingLegacyCompareCopy }) {
  return (
    <section
      className="px-4 py-8 md:py-10"
      aria-labelledby="landing-legacy-compare-title"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="landing-legacy-compare-title"
            className="m-0 text-xl font-bold tracking-tight text-[#34495E] md:text-2xl"
          >
            {copy.title}
          </h2>
          <p className="mt-2 m-0 text-[13px] leading-snug text-[#7F8C8D]">{copy.subtitle}</p>
        </div>

        <div className="dark mt-6 border-y border-slate-800/50 py-5 md:py-6">
          <ArenaHeader legacyBrand={copy.legacyBrand} eraBrand={copy.eraBrand} />

          <ul className="m-0 list-none p-0" role="list">
            {copy.rows.map((row) => (
              <BattleArenaRow key={row.topic} row={row} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
