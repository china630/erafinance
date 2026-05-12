"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import { PRIMARY_BUTTON_CLASS } from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

const TYPES = [
  "invoice",
  "journal_posting",
  "fx_snapshot",
  "fixed_asset_depreciation",
  "payroll_accrual",
] as const;

function isCalcType(v: string): v is (typeof TYPES)[number] {
  return (TYPES as readonly string[]).includes(v);
}

function AuditHubCalculationInner() {
  const { t } = useTranslation();
  useRequireAuth();
  const searchParams = useSearchParams();
  const [type, setType] = useState<(typeof TYPES)[number]>("invoice");
  const [id, setId] = useState("");
  const [json, setJson] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const qt = searchParams.get("type");
    const qi = searchParams.get("id");
    if (qt && isCalcType(qt)) {
      setType(qt);
    }
    if (qi) {
      setId(qi);
    }
  }, [searchParams]);

  async function load() {
    setErr(null);
    setJson("");
    const trimmed = id.trim();
    if (!trimmed) return;
    const res = await auditHubFetch(
      `/api/audit-hub/calculation/${encodeURIComponent(type)}/${encodeURIComponent(trimmed)}`,
    );
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    const data = await res.json();
    setJson(JSON.stringify(data, null, 2));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8C8D]">{t("auditHub.calcHint")}</p>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.calcType")}
          <select
            className="ml-2 rounded border border-[#D1D5DB] p-1.5 text-xs"
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
          >
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <input
          className="min-w-[240px] flex-1 rounded border border-[#D1D5DB] p-2 text-xs font-mono"
          placeholder={t("auditHub.calcIdPh")}
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("auditHub.load")}
        </button>
      </div>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      {json ? (
        <pre className="max-h-[480px] overflow-auto rounded border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-[11px] leading-relaxed">
          {json}
        </pre>
      ) : null}
    </div>
  );
}

export default function AuditHubCalculationPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={<p className="text-sm text-[#7F8C8D]">{t("auditHub.calcSuspense")}</p>}
    >
      <AuditHubCalculationInner />
    </Suspense>
  );
}
