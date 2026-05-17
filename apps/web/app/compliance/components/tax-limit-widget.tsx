"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";

export type VatThresholdMonitorDto = {
  year: number;
  turnoverAzn: number;
  linkedPaymentsAzn?: number;
  unlinkedPaymentsAzn?: number;
  invoiceTotalAzn: number;
  cashStandaloneAzn: number;
  thresholdAzn: number;
  warnAtAzn: number;
  criticalAtAzn: number;
  ratio: number;
  progressPct: number;
  band: "green" | "yellow" | "red";
};

function formatAzn(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} AZN`;
}

export function TaxLimitWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState<VatThresholdMonitorDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/compliance/vat-threshold-monitor");
    if (!res.ok) {
      setErr(t("compliance.taxLimit.loadErr"));
      setData(null);
      setLoading(false);
      return;
    }
    setData((await res.json()) as VatThresholdMonitorDto);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const barColor =
    data?.band === "red"
      ? "bg-red-500"
      : data?.band === "yellow"
        ? "bg-amber-400"
        : "bg-emerald-500";

  return (
    <section className="rounded-2xl border border-[#D5DADF] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#95A5A6]">
            {t("compliance.taxLimit.title")}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-[#7F8C8D]">
            {t("compliance.taxLimit.subtitle", {
              year: data?.year ?? new Date().getFullYear(),
            })}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-[#D5DADF] bg-white px-3 py-1.5 text-[13px] font-medium text-[#34495E] shadow-sm hover:bg-[#F8F9FA]"
          onClick={() => void load()}
          disabled={loading}
        >
          {t("compliance.refresh")}
        </button>
      </div>

      {err ? <p className="mt-3 text-[13px] text-red-600">{err}</p> : null}

      {loading && !data ? (
        <p className="mt-4 text-[13px] text-[#7F8C8D]">{t("compliance.loading")}</p>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-[#34495E]">
            <span className="font-semibold tabular-nums">{formatAzn(data.turnoverAzn)}</span>
            <span className="text-[#7F8C8D] tabular-nums">
              / {formatAzn(data.thresholdAzn)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-lg bg-[#ECF0F1]">
            <div
              className={`h-full rounded-lg transition-all duration-300 ${barColor}`}
              style={{ width: `${Math.min(100, data.progressPct)}%` }}
            />
          </div>
          <div className="grid gap-1 text-[13px] text-[#5D6D7E] sm:grid-cols-2">
            <p>
              <span className="font-medium text-[#34495E]">
                {t("compliance.taxLimit.fromInvoices")}
              </span>{" "}
              <span className="tabular-nums">
                {formatAzn(data.linkedPaymentsAzn ?? data.invoiceTotalAzn)}
              </span>
            </p>
            <p>
              <span className="font-medium text-[#34495E]">
                {t("compliance.taxLimit.fromCash")}
              </span>{" "}
              <span className="tabular-nums">
                {formatAzn(data.unlinkedPaymentsAzn ?? data.cashStandaloneAzn)}
              </span>
            </p>
            <p className="text-[12px] leading-snug text-[#95A5A6] sm:col-span-2">
              {t("compliance.taxLimit.bandsHint", {
                warn: formatAzn(data.warnAtAzn),
                critical: formatAzn(data.criticalAtAzn),
              })}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
