"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function AuditHubBackdatingPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [thresholdDays, setThresholdDays] = useState("1");
  const [entityTypes, setEntityTypes] = useState("invoice,transaction");
  const [items, setItems] = useState<unknown[] | null>(null);
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
    const body = (await res.json()) as { items: unknown[] };
    setItems(body.items ?? []);
  }, [token, from, to, thresholdDays, entityTypes, t]);

  if (!ready || !token) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8C8D]">{t("auditHub.backdatingHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} grid gap-3 sm:grid-cols-2`}>
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
      <div className={`${CARD_CONTAINER_CLASS} max-h-[480px] overflow-auto`}>
        <pre className="whitespace-pre-wrap break-all text-[11px]">
          {items ? JSON.stringify(items, null, 2) : "—"}
        </pre>
      </div>
    </div>
  );
}
