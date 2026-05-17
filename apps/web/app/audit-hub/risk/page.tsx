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
import { AuditHubRiskResultPanel } from "../../../components/audit-hub/audit-hub-risk-result";

export default function AuditHubRiskPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [windowDays, setWindowDays] = useState("7");
  const [take, setTake] = useState("100");
  const [expenseMinDebit, setExpenseMinDebit] = useState("50000");
  const [payload, setPayload] = useState<unknown | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (windowDays) q.set("windowDays", windowDays);
    if (take) q.set("take", take);
    if (expenseMinDebit.trim()) q.set("expenseMinDebit", expenseMinDebit.trim());
    const res = await auditHubFetch(`/api/audit-hub/risk?${q.toString()}`);
    if (!res.ok) {
      setErr(t("auditHub.loadErr"));
      return;
    }
    setPayload(await res.json());
  }, [token, from, to, windowDays, take, expenseMinDebit, t]);

  if (!ready || !token) return null;

  return (
    <div className="space-y-4">
      <p className="m-0 text-sm text-[#7F8C8D]">{t("auditHub.riskHint")}</p>
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
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("auditHub.riskWindowDays")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full`}
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value)}
            />
          </label>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("auditHub.riskTake")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full`}
              value={take}
              onChange={(e) => setTake(e.target.value)}
            />
          </label>
          <label className={`${MODAL_FIELD_LABEL_CLASS} sm:col-span-2`}>
            {t("auditHub.riskExpenseMinDebit")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full max-w-md`}
              value={expenseMinDebit}
              onChange={(e) => setExpenseMinDebit(e.target.value)}
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
      {payload ? <AuditHubRiskResultPanel payload={payload} /> : null}
    </div>
  );
}
