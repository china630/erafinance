"use client";

import { useCallback, useEffect, useState } from "react";
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

type AuditLogRow = {
  kind: "audit_log";
  id: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
};

type ActivityRow = {
  kind: "activity";
  id: string;
  verb: string;
  summary: string | null;
  actorUserId: string | null;
  createdAt: string;
};

type TimelineItem = AuditLogRow | ActivityRow;

export default function AuditHubTimelinePage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [take, setTake] = useState("50");
  const [items, setItems] = useState<TimelineItem[] | null>(null);
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
    const body = (await res.json()) as { items?: unknown[] };
    const raw = body.items ?? [];
    const parsed: TimelineItem[] = [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (r.kind === "audit_log" && typeof r.createdAt === "string") {
        parsed.push({
          kind: "audit_log",
          id: String(r.id ?? ""),
          userId: (r.userId as string | null) ?? null,
          entityType: String(r.entityType ?? ""),
          entityId: String(r.entityId ?? ""),
          action: String(r.action ?? ""),
          createdAt: r.createdAt,
        });
      } else if (r.kind === "activity" && typeof r.createdAt === "string") {
        parsed.push({
          kind: "activity",
          id: String(r.id ?? ""),
          verb: String(r.verb ?? ""),
          summary: r.summary == null ? null : String(r.summary),
          actorUserId: (r.actorUserId as string | null) ?? null,
          createdAt: r.createdAt,
        });
      }
    }
    setItems(parsed);
  }, [token, entityType, entityId, take, t]);

  useEffect(() => {
    if (!token) return;
    void load();
    // Initial fetch only; filter changes use the Load button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!ready || !token) return null;

  return (
    <div className="space-y-4">
      <p className="m-0 text-sm text-[#7F8C8D]">{t("auditHub.timelineHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-[13px] font-semibold text-[#34495E]">
            {t("auditHub.entityTypePh")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
              placeholder={t("auditHub.entityTypePh")}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-semibold text-[#34495E]">
            {t("auditHub.entityIdPh")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
              placeholder={t("auditHub.entityIdPh")}
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-semibold text-[#34495E]">
            {t("auditHub.timelineTakePh")}
            <input
              className={`${INPUT_BORDERED_CLASS} mt-1 w-full`}
              placeholder="50"
              value={take}
              onChange={(e) => setTake(e.target.value)}
            />
          </label>
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("auditHub.load")}
        </button>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
      </div>

      {items && items.length > 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-0`}>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead className={DATA_TABLE_HEAD_ROW_CLASS}>
                <tr>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.timelineColTime")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.timelineColKind")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.timelineColEntity")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("auditHub.timelineColAction")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap text-xs`}>
                      {row.createdAt?.replace("T", " ").slice(0, 19) ?? "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{row.kind}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                      {row.kind === "audit_log"
                        ? `${row.entityType} · ${row.entityId.slice(0, 8)}…`
                        : row.summary || row.verb}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>
                      {row.kind === "audit_log" ? row.action : row.verb}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {items && items.length === 0 ? (
        <p className="text-sm text-[#7F8C8D]">—</p>
      ) : null}

      {items && items.length > 0 ? (
        <details className="rounded-xl border border-[#D5DADF] bg-white p-3 text-[13px] text-[#34495E]">
          <summary className="cursor-pointer font-medium text-[#2980B9]">{t("auditHub.showRawJson")}</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] text-[#34495E]">
            {JSON.stringify(items, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
