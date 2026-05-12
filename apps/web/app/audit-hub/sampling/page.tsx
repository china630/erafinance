"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function AuditHubSamplingPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [scope, setScope] = useState("sales_invoices");
  const [mode, setMode] = useState<"random" | "materiality">("random");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [percent, setPercent] = useState("5");
  const [threshold, setThreshold] = useState("");
  const [result, setResult] = useState<unknown>(null);
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
    setResult(await res.json());
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8C8D]">{t("auditHub.samplingHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} grid gap-3 sm:grid-cols-2`}>
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
      <div className={`${CARD_CONTAINER_CLASS}`}>
        <div className="text-xs font-semibold text-[#95A5A6]">{t("auditHub.sampleResult")}</div>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all text-[11px]">
          {result ? JSON.stringify(result, null, 2) : "—"}
        </pre>
      </div>
    </div>
  );
}
