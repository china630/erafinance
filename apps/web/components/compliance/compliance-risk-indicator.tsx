"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { useSubscription } from "../../lib/subscription-context";

type RiskSummary = {
  posture: "green" | "yellow" | "red";
  pending: { high: number; medium: number; low: number; total: number };
};

function postureClasses(posture: RiskSummary["posture"]): string {
  if (posture === "red") return "bg-red-500 shadow-red-200";
  if (posture === "yellow") return "bg-amber-400 shadow-amber-100";
  return "bg-emerald-500 shadow-emerald-100";
}

/**
 * Header “traffic light” for ERM — only when `compliance_pro` is entitled.
 */
export function ComplianceRiskIndicator() {
  const { t } = useTranslation();
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [neutral, setNeutral] = useState(false);

  const tier = snapshot?.tier ? String(snapshot.tier).toUpperCase() : "";
  const moduleOn =
    subReady &&
    snapshot &&
    (tier === "TIER_3" || snapshot.modules.compliancePro === true);

  const load = useCallback(async () => {
    if (!moduleOn) return;
    const res = await apiFetch("/api/compliance/risk-summary");
    if (res.status === 403) {
      setNeutral(true);
      setSummary(null);
      return;
    }
    if (!res.ok) {
      setNeutral(true);
      setSummary(null);
      return;
    }
    setNeutral(false);
    setSummary((await res.json()) as RiskSummary);
  }, [moduleOn]);

  useEffect(() => {
    if (!moduleOn) {
      setSummary(null);
      setNeutral(false);
      return;
    }
    void load();
  }, [moduleOn, load]);

  if (!moduleOn) return null;

  const posture = summary?.posture ?? (neutral ? "green" : "green");
  const showPulse = summary && summary.pending.total > 0;

  return (
    <Link
      href="/compliance"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5DADF] bg-white px-2 py-1.5 text-[12px] font-medium text-[#34495E] shadow-sm transition hover:border-[#2980B9]/40 hover:bg-[#2980B9]/5"
      title={t("compliance.riskIndicatorAria", {
        posture: summary ? t(`compliance.posture.${summary.posture}`) : "—",
      })}
      aria-label={t("compliance.riskIndicatorAria", {
        posture: summary ? t(`compliance.posture.${summary.posture}`) : "—",
      })}
    >
      <span
        className={[
          "relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full shadow-sm",
          postureClasses(posture),
          showPulse ? "animate-pulse" : "",
        ].join(" ")}
        aria-hidden
      />
      <span className="hidden sm:inline">{t("compliance.riskIndicatorShort")}</span>
    </Link>
  );
}

