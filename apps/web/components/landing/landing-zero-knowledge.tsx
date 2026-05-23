import { Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { LANDING_CARD_HOVER_CLASS } from "../../lib/landing-motion";
import type { LandingZeroKnowledgeCopy } from "../../lib/i18n/landing-marketing-copy";

export function LandingZeroKnowledge({ copy }: { copy: LandingZeroKnowledgeCopy }) {
  return (
    <section
      className="px-4 py-10 md:py-14"
      aria-labelledby="landing-zero-knowledge-title"
    >
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
        <article
          className={`relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/95 p-6 shadow-lg backdrop-blur-xl md:col-span-2 md:p-8 ${LANDING_CARD_HOVER_CLASS}`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl"
          />
          <div className="relative">
            <span className="inline-flex rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-300">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <h2
              id="landing-zero-knowledge-title"
              className="mt-4 m-0 text-xl font-bold leading-snug tracking-tight text-white md:text-2xl"
            >
              {copy.title}
            </h2>
            <ul className="mt-5 flex min-h-[9.5rem] flex-col gap-3.5 p-0 list-none md:min-h-[8.5rem]">
              {copy.claims.map((claim) => (
                <li key={claim.title} className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="m-0 text-[13px] font-semibold leading-snug text-slate-100">
                      {claim.title}
                    </p>
                    <p className="mt-0.5 m-0 text-[12px] leading-snug text-slate-300">
                      {claim.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <aside
          className={`flex flex-col justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/95 p-5 backdrop-blur-xl ${LANDING_CARD_HOVER_CLASS}`}
        >
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {copy.identityEyebrow}
            </p>
            <ul className="mt-3 flex flex-col gap-2 p-0 list-none">
              {copy.badges.map((badge) => (
                <li
                  key={badge}
                  className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-[13px] font-medium text-white"
                >
                  <Fingerprint className="h-4 w-4 shrink-0 text-indigo-300" aria-hidden />
                  {badge}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5">
            <p className="m-0 flex items-center gap-2 text-[12px] text-slate-400">
              <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-emerald-400/90" aria-hidden />
              <span>{copy.encryptionNote}</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
