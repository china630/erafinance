import Link from "next/link";
import { LandingChrome } from "./landing-chrome";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";
import type { LandingModuleMarketingItem } from "../../lib/config/landing-modules";

type LandingCopy = {
  heroTitle: string;
  heroSubtitle: string;
  disclaimer: string;
  ctaRegister: string;
  ctaPricing: string;
};

export function LandingPageView({
  locale,
  modules,
  copy,
}: {
  locale: "az" | "ru";
  modules: LandingModuleMarketingItem[];
  copy: LandingCopy;
}) {
  const sorted = [...modules].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.moduleSlug.localeCompare(b.moduleSlug),
  );

  return (
    <main className="min-h-screen bg-[#EBEDF0]">
      <LandingChrome />
      <div className="mx-auto max-w-5xl px-4 pb-16">
        <section
          className={`${CARD_CONTAINER_CLASS} mb-8 bg-gradient-to-br from-[#2980B9] to-[#2471A3] p-8 text-white`}
        >
          <h1 className="m-0 text-2xl font-bold md:text-3xl">{copy.heroTitle}</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed opacity-95">
            {copy.heroSubtitle}
          </p>
          <p className="mt-3 max-w-2xl text-[13px] leading-snug opacity-80">
            {copy.disclaimer}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register-org" className={`${PRIMARY_BUTTON_CLASS} no-underline`}>
              {copy.ctaRegister}
            </Link>
            <Link
              href="/pricing"
              className={`${SECONDARY_BUTTON_CLASS} border-white/40 bg-white/10 text-white no-underline hover:bg-white/20`}
            >
              {copy.ctaPricing}
            </Link>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((m) => {
            const name = m.names[locale];
            const desc = m.descriptions[locale];
            const tasks = m.tasks[locale];
            return (
              <article key={m.moduleSlug} className={`${CARD_CONTAINER_CLASS} p-5`}>
                <h2 className="m-0 text-base font-semibold text-[#34495E]">{name}</h2>
                <p className="mt-2 text-[13px] leading-snug text-[#7F8C8D]">{desc}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-[#34495E]">
                  {tasks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
