"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { AuditHubNasIfrsResultPanel } from "../../../components/audit-hub/audit-hub-nas-ifrs-result";

export default function AuditHubReconciliationPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [take, setTake] = useState("200");
  const [includeTotals, setIncludeTotals] = useState(false);
  const [payload, setPayload] = useState<unknown | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (take) q.set("take", take);
    if (includeTotals) q.set("includeTotalsMismatch", "true");
    const res = await auditHubFetch(
      `/api/audit-hub/reconciliation/nas-ifrs?${q.toString()}`,
    );
    if (!res.ok) {
      setErr(t("auditHub.loadErr"));
      return;
    }
    setPayload(await res.json());
  }, [token, from, to, take, includeTotals, t]);

  if (!ready || !token) return null;

  return (
    <div className="space-y-4">
      <p className="m-0 text-sm text-[#7F8C8D]">{t("auditHub.reconHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("auditHub.periodFrom")}
            <input
              type="date"
              className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full`}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("auditHub.periodTo")}
            <input
              type="date"
              className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full`}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className={`${MODAL_FIELD_LABEL_CLASS} sm:col-span-2`}>
            {t("auditHub.reconTake")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full max-w-xs`}
              value={take}
              onChange={(e) => setTake(e.target.value)}
            />
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D5DADF] text-[#2980B9] focus:ring-[#2980B9]/30"
              checked={includeTotals}
              onChange={(e) => setIncludeTotals(e.target.checked)}
            />
            <span className="text-[13px] font-semibold leading-snug text-[#34495E]">
              {t("auditHub.reconIncludeTotals")}
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EBEDF0] pt-3">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
            {t("auditHub.load")}
          </button>
        </div>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {payload ? <AuditHubNasIfrsResultPanel payload={payload} /> : null}
    </div>
  );
}
