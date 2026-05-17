"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { uiLangRuAz } from "../../../lib/i18n/ui-lang";

type ElderVerdict = {
  score?: number;
  stance?: string;
  findings?: string[];
  reasoning?: string;
};

export type CouncilVerdictRow = {
  id: string;
  status: string;
  elderVerdicts: {
    tax?: ElderVerdict;
    forensic?: ElderVerdict;
    strategist?: ElderVerdict;
  } | null;
  summaryAz?: string | null;
  summaryRu?: string | null;
  suggestedAction?: string | null;
  finalScore?: number | null;
  finalSeverity?: string | null;
  riskAuditId?: string | null;
  errorMessage?: string | null;
};

function stanceChipClass(stance?: string): string {
  if (stance === "high_risk") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (stance === "watch") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-emerald-50 text-emerald-800 border-emerald-200";
}

function stanceLabelKey(stance?: string): string {
  if (stance === "high_risk") return "compliance.council.stanceHighRisk";
  if (stance === "watch") return "compliance.council.stanceWatch";
  return "compliance.council.stanceClear";
}

function SummaryBody({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const bullets = lines.filter((l) => l.trimStart().startsWith("- "));
  const paragraphs = lines.filter((l) => !l.trimStart().startsWith("- "));
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-[#34495E]">
      {paragraphs.map((line, i) => (
        <p key={`p-${i}`}>{line}</p>
      ))}
      {bullets.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {bullets.map((line, i) => (
            <li key={`b-${i}`}>{line.replace(/^\s*-\s*/, "")}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ElderCard({
  title,
  elder,
  t,
}: {
  title: string;
  elder?: ElderVerdict;
  t: (key: string) => string;
}) {
  return (
    <div
      className={`${CARD_CONTAINER_CLASS} rounded-lg border border-[#D5DADF] bg-white p-4`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[#34495E]">{title}</h3>
        <span
          className={[
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            stanceChipClass(elder?.stance),
          ].join(" ")}
        >
          {t(stanceLabelKey(elder?.stance))}
        </span>
      </div>
      <p className="mt-2 font-mono text-[12px] tabular-nums text-[#7F8C8D]">
        {elder?.score != null ? `${elder.score}/100` : "—"}
      </p>
      {elder?.reasoning ? (
        <p className="mt-2 text-[12px] leading-snug text-[#5D6D7E]">{elder.reasoning}</p>
      ) : null}
    </div>
  );
}

export function CouncilChamberPanel({
  verdictId,
  canMitigate,
}: {
  verdictId: string;
  canMitigate: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [row, setRow] = useState<CouncilVerdictRow | null>(null);
  const [summaryLang, setSummaryLang] = useState<"ru" | "az">(
    uiLangRuAz(i18n.language),
  );
  const [err, setErr] = useState<string | null>(null);
  const [mitigating, setMitigating] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/compliance/council/verdicts/${verdictId}`);
    if (!res.ok) {
      setErr(t("compliance.loadErr"));
      return;
    }
    setRow((await res.json()) as CouncilVerdictRow);
  }, [verdictId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!row) return;
    if (row.status !== "QUEUED" && row.status !== "RUNNING") return;
    const id = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(id);
  }, [row, load]);

  const elders = row?.elderVerdicts ?? {};
  const summaryText = useMemo(() => {
    if (!row) return "";
    if (summaryLang === "az") return row.summaryAz?.trim() ?? "";
    return row.summaryRu?.trim() ?? "";
  }, [row, summaryLang]);

  const onMitigate = useCallback(async () => {
    if (!row?.riskAuditId) return;
    setMitigating(true);
    setErr(null);
    const res = await apiFetch(`/api/compliance/risk-audits/${row.riskAuditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "MITIGATED",
        mitigationNote: row.suggestedAction?.trim() || undefined,
      }),
    });
    setMitigating(false);
    if (!res.ok) {
      setErr(t("compliance.patchErr"));
    }
  }, [row, t]);

  const inProgress = row?.status === "QUEUED" || row?.status === "RUNNING";

  return (
    <div className="space-y-6">
      <div
        className={`${CARD_CONTAINER_CLASS} rounded-2xl border border-[#D5DADF] bg-white p-5 sm:p-6`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-[#34495E]">
            {inProgress
              ? row?.status === "QUEUED"
                ? t("compliance.council.statusQueued")
                : t("compliance.council.statusRunning")
              : row?.status === "FAILED"
                ? t("compliance.council.statusFailed")
                : row?.status === "COMPLETED"
                  ? t("compliance.council.statusCompleted")
                  : row?.status ?? "—"}
          </p>
          {inProgress ? (
            <span className="text-[12px] text-[#7F8C8D]">{t("compliance.council.polling")}</span>
          ) : null}
        </div>

        {row?.status === "FAILED" && row.errorMessage ? (
          <p className="mt-3 text-sm text-red-600">
            {t("compliance.council.errorLabel")}: {row.errorMessage}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ElderCard title={t("compliance.council.elderTax")} elder={elders.tax} t={t} />
          <ElderCard
            title={t("compliance.council.elderForensic")}
            elder={elders.forensic}
            t={t}
          />
          <ElderCard
            title={t("compliance.council.elderStrategist")}
            elder={elders.strategist}
            t={t}
          />
        </div>
      </div>

      {row?.status === "COMPLETED" ? (
        <div
          className={`${CARD_CONTAINER_CLASS} rounded-2xl border border-[#D5DADF] bg-white p-5 sm:p-6`}
        >
          <h2 className="text-[13px] font-semibold text-[#34495E]">
            {t("compliance.council.finalVerdict")}
          </h2>
          {row.finalScore != null ? (
            <p className="mt-1 text-[12px] text-[#7F8C8D]">
              {t("compliance.council.finalScore")}:{" "}
              <span className="font-mono tabular-nums text-[#34495E]">{row.finalScore}/100</span>
              {row.finalSeverity ? (
                <span className="ml-2">
                  · {t(`compliance.severity.${row.finalSeverity}`)}
                </span>
              ) : null}
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={[
                "rounded-lg px-3 py-1 text-[12px] font-semibold",
                summaryLang === "ru"
                  ? "bg-[#2980B9] text-white"
                  : "border border-[#D5DADF] bg-white text-[#34495E]",
              ].join(" ")}
              onClick={() => setSummaryLang("ru")}
            >
              {t("compliance.council.summaryTabRu")}
            </button>
            <button
              type="button"
              className={[
                "rounded-lg px-3 py-1 text-[12px] font-semibold",
                summaryLang === "az"
                  ? "bg-[#2980B9] text-white"
                  : "border border-[#D5DADF] bg-white text-[#34495E]",
              ].join(" ")}
              onClick={() => setSummaryLang("az")}
            >
              {t("compliance.council.summaryTabAz")}
            </button>
          </div>

          {summaryText ? (
            <div className="mt-3">
              <SummaryBody text={summaryText} />
            </div>
          ) : null}

          {row.suggestedAction ? (
            <div className="mt-4 rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#95A5A6]">
                {t("compliance.council.suggestedAction")}
              </p>
              <p className="mt-1 text-[13px] text-[#34495E]">{row.suggestedAction}</p>
            </div>
          ) : null}

          {row.riskAuditId && canMitigate ? (
            <div className="mt-4">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={mitigating}
                onClick={() => void onMitigate()}
              >
                {t("compliance.council.mitigateCta")}
              </button>
            </div>
          ) : row.suggestedAction ? (
            <p className="mt-3 text-[12px] text-[#7F8C8D]">
              {t("compliance.council.mitigateNoAudit")}
            </p>
          ) : null}
        </div>
      ) : null}

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
