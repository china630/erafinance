"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
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
  const { ready, token } = useRequireAuth();
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

  if (!ready || !token) return null;

  return (
    <div className="space-y-4">
      <p className="m-0 text-sm text-[#7F8C8D]">{t("auditHub.calcHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <div className="max-w-2xl space-y-4">
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("auditHub.calcType")}
            <select
              className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full`}
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
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("auditHub.calcIdPh")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full font-mono`}
              placeholder={t("auditHub.calcIdPh")}
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EBEDF0] pt-3">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
            {t("auditHub.load")}
          </button>
        </div>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {json ? (
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <pre className="max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-[#34495E]">
            {json}
          </pre>
        </div>
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
