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

export default function AuditHubTimelinePage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [take, setTake] = useState("50");
  const [items, setItems] = useState<unknown[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const q = new URLSearchParams();
    if (entityType.trim()) q.set("entityType", entityType.trim());
    if (entityId.trim()) q.set("entityId", entityId.trim());
    if (take.trim()) q.set("take", take.trim());
    const res = await auditHubFetch(`/api/audit-hub/timeline?${q.toString()}`);
    if (!res.ok) {
      setErr(t("auditHub.loadErr"));
      setItems(null);
      return;
    }
    const body = (await res.json()) as { items: unknown[] };
    setItems(body.items ?? []);
  }, [token, entityType, entityId, take, t]);

  if (!ready || !token) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8C8D]">{t("auditHub.timelineHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} space-y-3`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className={INPUT_BORDERED_CLASS}
            placeholder={t("auditHub.entityTypePh")}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
          <input
            className={INPUT_BORDERED_CLASS}
            placeholder={t("auditHub.entityIdPh")}
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          />
          <input
            className={INPUT_BORDERED_CLASS}
            placeholder="take"
            value={take}
            onChange={(e) => setTake(e.target.value)}
          />
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("auditHub.load")}
        </button>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
      </div>
      <div className={`${CARD_CONTAINER_CLASS} max-h-[480px] overflow-auto`}>
        <pre className="whitespace-pre-wrap break-all text-[11px] text-[#34495E]">
          {items ? JSON.stringify(items, null, 2) : "—"}
        </pre>
      </div>
    </div>
  );
}
