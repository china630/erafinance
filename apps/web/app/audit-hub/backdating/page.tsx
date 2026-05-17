"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type BackdatingRow = {
  entityType: string;
  entityId: string;
  label: string;
  documentDate: string;
  createdAt: string;
  deltaDays: number;
};

export default function AuditHubBackdatingPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [thresholdDays, setThresholdDays] = useState("1");
  const [entityTypes, setEntityTypes] = useState("invoice,transaction");
  const [items, setItems] = useState<BackdatingRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (thresholdDays) q.set("thresholdDays", thresholdDays);
    if (entityTypes.trim()) q.set("entityTypes", entityTypes.trim());
    const res = await auditHubFetch(`/api/audit-hub/backdating?${q.toString()}`);
    if (!res.ok) {
      setErr(t("auditHub.loadErr"));
      return;
    }
    const body = (await res.json()) as { items: BackdatingRow[] };
    setItems(body.items ?? []);
  }, [token, from, to, thresholdDays, entityTypes, t]);

  if (!ready || !token) return null;

  const rows = items ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8C8D]">{t("auditHub.backdatingHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} grid gap-3 p-4 sm:grid-cols-2`}>
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.periodFrom")}
          <input
            type="date"
            className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.periodTo")}
          <input
            type="date"
            className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.thresholdDays")}
          <input
            className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
            value={thresholdDays}
            onChange={(e) => setThresholdDays(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-[#34495E]">
          {t("auditHub.entityTypes")}
          <input
            className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
            value={entityTypes}
            onChange={(e) => setEntityTypes(e.target.value)}
          />
        </label>
      </div>
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
        {t("auditHub.load")}
      </button>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {items !== null && rows.length > 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-0`}>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead className={DATA_TABLE_HEAD_ROW_CLASS}>
                <tr>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.timelineColKind")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.backdatingColLabel")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.backdatingColDocDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.backdatingColCreated")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("auditHub.backdatingColDelta")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.entityType}-${row.entityId}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{row.entityType}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{row.label}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap text-xs`}>{row.documentDate}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap text-xs`}>
                      {row.createdAt?.replace("T", " ").slice(0, 19)}
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} text-xs`}>{row.deltaDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {items !== null && rows.length === 0 ? (
        <p className="text-sm text-[#7F8C8D]">—</p>
      ) : null}

      {items !== null && rows.length > 0 ? (
        <details className="rounded-xl border border-[#D5DADF] bg-white p-3 text-[13px] text-[#34495E]">
          <summary className="cursor-pointer font-medium text-[#2980B9]">{t("auditHub.showRawJson")}</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] text-[#34495E]">
            {JSON.stringify(rows, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
