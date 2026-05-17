"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type SamplingResult = {
  id: string;
  scope: string;
  mode: string;
  seed?: string;
  count?: number;
  documentRefs?: Array<{ entityType: string; entityId: string }>;
  createdAt?: string;
};

export default function AuditHubSamplingPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [scope, setScope] = useState("sales_invoices");
  const [mode, setMode] = useState<"random" | "materiality">("random");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [percent, setPercent] = useState("5");
  const [threshold, setThreshold] = useState("");
  const [result, setResult] = useState<SamplingResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ready || !token) return null;

  async function submit() {
    if (!token) return;
    setErr(null);
    const body: Record<string, unknown> = {
      scope,
      mode,
      periodFrom,
      periodTo,
    };
    if (mode === "random" && percent.trim()) body.percent = Number(percent);
    if (mode === "materiality" && threshold.trim()) {
      body.thresholdAmount = Number(threshold);
    }
    const res = await auditHubFetch("/api/audit-hub/sampling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    const data = (await res.json()) as SamplingResult;
    setResult(data);
  }

  const refs = result?.documentRefs ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8C8D]">{t("auditHub.samplingHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} grid gap-3 p-4 sm:grid-cols-2`}>
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.scope")}
          <select
            className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="sales_invoices">sales_invoices</option>
            <option value="transactions">transactions</option>
            <option value="customs_declarations">customs_declarations</option>
            <option value="ocr_jobs">ocr_jobs</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.mode")}
          <select
            className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
            value={mode}
            onChange={(e) => setMode(e.target.value as "random" | "materiality")}
          >
            <option value="random">random</option>
            <option value="materiality">materiality</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.periodFrom")}
          <input
            type="date"
            className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.periodTo")}
          <input
            type="date"
            className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </label>
        {mode === "random" ? (
          <label className="text-xs font-semibold text-[#34495E]">
            {t("auditHub.percent")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </label>
        ) : (
          <label className="text-xs font-semibold text-[#34495E]">
            {t("auditHub.threshold")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </label>
        )}
      </div>
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void submit()}>
        {t("auditHub.createSample")}
      </button>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {result ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
          <div className="text-xs font-semibold text-[#95A5A6]">{t("auditHub.samplingSummary")}</div>
          <dl className="grid gap-1 text-[13px] text-[#34495E] sm:grid-cols-2">
            <div>
              <dt className="text-[#7F8C8D]">ID</dt>
              <dd className="m-0 font-mono text-xs">{result.id}</dd>
            </div>
            <div>
              <dt className="text-[#7F8C8D]">{t("auditHub.scope")}</dt>
              <dd className="m-0">{result.scope}</dd>
            </div>
            <div>
              <dt className="text-[#7F8C8D]">{t("auditHub.mode")}</dt>
              <dd className="m-0">{result.mode}</dd>
            </div>
            <div>
              <dt className="text-[#7F8C8D]">{t("auditHub.sampleResult")}</dt>
              <dd className="m-0">{result.count ?? refs.length}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {result && refs.length > 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-0`}>
          <div className="border-b border-[#D5DADF] px-4 py-2 text-xs font-semibold text-[#95A5A6]">
            {t("auditHub.samplingRefsTitle")}
          </div>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead className={DATA_TABLE_HEAD_ROW_CLASS}>
                <tr>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.samplingColEntityType")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.samplingColEntityId")}</th>
                </tr>
              </thead>
              <tbody>
                {refs.map((r, i) => (
                  <tr key={`${r.entityType}-${r.entityId}-${i}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{r.entityType}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>{r.entityId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result ? (
        <details className="rounded-xl border border-[#D5DADF] bg-white p-3 text-[13px] text-[#34495E]">
          <summary className="cursor-pointer font-medium text-[#2980B9]">{t("auditHub.showRawJson")}</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all text-[11px] text-[#34495E]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <div className="text-xs font-semibold text-[#95A5A6]">{t("auditHub.sampleResult")}</div>
          <p className="m-0 mt-2 text-sm text-[#7F8C8D]">—</p>
        </div>
      )}
    </div>
  );
}
