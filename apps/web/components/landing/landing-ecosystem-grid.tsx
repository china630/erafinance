import { LANDING_CARD_HOVER_CLASS } from "../../lib/landing-motion";
import {
  Brain,
  Building2,
  Calculator,
  Factory,
  Landmark,
  MessageCircle,
  Package,
  Shield,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  Globe2,
  BookOpen,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import type {
  EcosystemModuleCopy,
  EcosystemModuleStatus,
  LandingEcosystemCopy,
} from "../../lib/i18n/landing-marketing-copy";

const MODULE_ICONS: Record<string, LucideIcon> = {
  core_accounting: BookOpen,
  cash_bank: Wallet,
  treasury: Calculator,
  supply_chain: Handshake,
  warehouse: Package,
  manufacturing: Factory,
  fixed_assets: Landmark,
  hr_payroll: Users,
  retail: ShoppingBag,
  construction: Building2,
  logistics: Truck,
  crm_whatsapp: MessageCircle,
  tax_pro: Shield,
  trade_pro: Globe2,
  compliance_pro: Brain,
};

function statusLabel(copy: LandingEcosystemCopy, status: EcosystemModuleStatus): string {
  if (status === "trial") return copy.statusTrial;
  if (status === "beta") return copy.statusBeta;
  return copy.statusPremium;
}

function StatusBadge({
  status,
  label,
  premiumGlow,
}: {
  status: EcosystemModuleStatus;
  label: string;
  premiumGlow?: string;
}) {
  if (status === "premium") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.35)]">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 motion-safe:animate-pulse" aria-hidden />
        {label}
        {premiumGlow ? (
          <span className="rounded bg-violet-500/20 px-1 py-px text-[9px] text-violet-200">{premiumGlow}</span>
        ) : null}
      </span>
    );
  }
  if (status === "beta") {
    return (
      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        {label}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
      {label}
    </span>
  );
}

function ModuleCard({
  module,
  copy,
  isPremiumSection,
}: {
  module: EcosystemModuleCopy;
  copy: LandingEcosystemCopy;
  isPremiumSection: boolean;
}) {
  const Icon = MODULE_ICONS[module.slug] ?? Package;
  const label = statusLabel(copy, module.status);

  return (
    <article
      className={
        isPremiumSection
          ? `flex h-full flex-col rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-slate-900 via-indigo-950/95 to-slate-900 p-4 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30 ${LANDING_CARD_HOVER_CLASS}`
          : `flex h-full flex-col rounded-2xl border border-[#D5DADF] bg-white p-4 shadow-sm ${LANDING_CARD_HOVER_CLASS}`
      }
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <span
              className={
                isPremiumSection
                  ? "inline-flex rounded-lg bg-indigo-500/15 p-2 text-indigo-300"
                  : "inline-flex rounded-lg bg-[#F4F5F7] p-2 text-[#2980B9]"
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <StatusBadge
              status={module.status}
              label={label}
              premiumGlow={isPremiumSection ? copy.premiumGlowBadge : undefined}
            />
          </div>
          <h3
            className={`mt-3 text-[15px] font-semibold leading-snug ${
              isPremiumSection ? "text-white" : "text-[#34495E]"
            }`}
          >
            {module.title}
          </h3>
        </div>
        <ul className={`mt-3 space-y-1.5 p-0 list-none ${isPremiumSection ? "text-slate-300" : ""}`}>
          {module.tasks.map((task) => (
            <li key={task} className="flex gap-2 text-[13px] leading-snug">
              <span
                className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${
                  isPremiumSection ? "bg-indigo-400" : "bg-[#2980B9]"
                }`}
                aria-hidden
              />
              <span className={isPremiumSection ? "text-slate-300" : "text-[#7F8C8D]"}>{task}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function LandingEcosystemGrid({ copy }: { copy: LandingEcosystemCopy }) {
  return (
    <section className="w-full px-4 py-10 md:py-14" aria-labelledby="landing-ecosystem-title">
      <div className="mx-auto max-w-6xl">
        {copy.sections.map((section) => {
          const isPremium = section.id === "premium";
          return (
            <div key={section.id} className="mb-10 last:mb-0 md:mb-12">
              <h2
                id={section.id === "operational" ? "landing-ecosystem-title" : undefined}
                className={`m-0 text-lg font-bold tracking-tight md:text-xl ${
                  isPremium ? "text-indigo-950" : "text-[#34495E]"
                }`}
              >
                {section.title}
              </h2>
              <div
                className={`mt-4 grid items-stretch gap-3 sm:grid-cols-2 ${
                  isPremium ? "lg:grid-cols-3" : section.modules.length >= 6 ? "lg:grid-cols-4" : "lg:grid-cols-3"
                }`}
              >
                {section.modules.map((mod) => (
                  <div key={mod.slug} className="h-full">
                    <ModuleCard module={mod} copy={copy} isPremiumSection={isPremium} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-500 md:mt-10">
          {copy.disclaimer}
        </p>
      </div>
    </section>
  );
}
