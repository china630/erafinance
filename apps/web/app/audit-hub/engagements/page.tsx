"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../lib/auth-context";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type Engagement = {
  id: string;
  title: string;
  status: string;
  periodFrom: string | null;
  periodTo: string | null;
  createdAt: string;
};

type OutboxInvite = {
  id: string;
  status: string;
  inviteeEmail: string | null;
  inviteeUserId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export default function AuditHubEngagementsPage() {
  const { t } = useTranslation();
  useRequireAuth();
  const { user } = useAuth();
  const canAdminInvites =
    user?.role === "OWNER" || user?.role === "ADMIN";

  const [list, setList] = useState<Engagement[]>([]);
  const [outbox, setOutbox] = useState<OutboxInvite[]>([]);
  const [title, setTitle] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [lastInviteId, setLastInviteId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const [eRes, oRes] = await Promise.all([
      auditHubFetch("/api/audit-hub/engagements"),
      canAdminInvites
        ? auditHubFetch("/api/audit-hub/engagements/invites/outbox")
        : Promise.resolve(null as Response | null),
    ]);
    if (!eRes.ok) {
      setErr(await eRes.text());
      return;
    }
    const eData = (await eRes.json()) as Engagement[];
    setList(Array.isArray(eData) ? eData : []);
    if (oRes) {
      if (!oRes.ok) {
        setErr(await oRes.text());
        return;
      }
      const oData = (await oRes.json()) as OutboxInvite[];
      setOutbox(Array.isArray(oData) ? oData : []);
    } else {
      setOutbox([]);
    }
  }, [canAdminInvites]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createEngagement() {
    setErr(null);
    const res = await auditHubFetch("/api/audit-hub/engagements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        periodFrom: periodFrom.trim() || undefined,
        periodTo: periodTo.trim() || undefined,
      }),
    });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setTitle("");
    await load();
  }

  async function createInvite() {
    setInviteBusy(true);
    setErr(null);
    setLastToken(null);
    setLastInviteId(null);
    const res = await auditHubFetch("/api/audit-hub/engagements/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteeEmail: inviteeEmail.trim() || undefined,
        expiresInDays: 14,
      }),
    });
    setInviteBusy(false);
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    const data = (await res.json()) as { id?: string; token?: string };
    if (data.token) setLastToken(data.token);
    if (data.id) setLastInviteId(data.id);
    setInviteeEmail("");
    await load();
  }

  async function revokeInvite(id: string) {
    if (!window.confirm(t("auditHub.engagementsRevokeConfirm"))) return;
    setErr(null);
    const res = await auditHubFetch(
      `/api/audit-hub/engagements/invites/${encodeURIComponent(id)}/revoke`,
      { method: "POST" },
    );
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#D5DADF] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#34495E]">{t("auditHub.engagementsListTitle")}</h2>
        {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
        {list.length === 0 ? (
          <p className="mt-2 text-xs text-[#7F8C8D]">{t("auditHub.engagementsEmpty")}</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {list.map((row) => (
              <li key={row.id} className="rounded border border-[#F3F4F6] px-3 py-2">
                <div className="font-medium text-[#34495E]">
                  <Link
                    href={`/audit-hub/engagements/${encodeURIComponent(row.id)}`}
                    className="text-[#2980B9] hover:underline"
                  >
                    {row.title}
                  </Link>
                </div>
                <div className="text-[#7F8C8D]">
                  {row.status} · {row.id}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[#D5DADF] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#34495E]">{t("auditHub.engagementsCreateTitle")}</h2>
        <div className="mt-2 space-y-2">
          <input
            className="w-full rounded border border-[#D1D5DB] p-2 text-xs"
            placeholder={t("auditHub.engagementsTitlePh")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              className="rounded border border-[#D1D5DB] p-2 text-xs"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
            />
            <input
              type="date"
              className="rounded border border-[#D1D5DB] p-2 text-xs"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!title.trim()}
            onClick={() => void createEngagement()}
          >
            {t("auditHub.engagementsCreateBtn")}
          </button>
        </div>
      </section>

      {canAdminInvites ? (
        <section className="rounded-xl border border-[#D5DADF] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[#34495E]">{t("auditHub.engagementsInvitesTitle")}</h2>
          <p className="mt-1 text-xs text-[#7F8C8D]">{t("auditHub.engagementsInvitesHint")}</p>
          {lastToken ? (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <div className="font-semibold">{t("auditHub.engagementsTokenOnce")}</div>
              <div className="mt-1 break-all font-mono">{lastToken}</div>
              {lastInviteId ? (
                <div className="mt-1 text-[11px]">
                  {t("auditHub.engagementsInviteIdLabel")}: {lastInviteId}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded border border-[#D1D5DB] p-2 text-xs"
              placeholder={t("auditHub.engagementsInviteeEmailPh")}
              value={inviteeEmail}
              onChange={(e) => setInviteeEmail(e.target.value)}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={inviteBusy || !inviteeEmail.trim()}
              onClick={() => void createInvite()}
            >
              {t("auditHub.engagementsInviteSend")}
            </button>
          </div>
          <h3 className="mt-4 text-xs font-semibold text-[#34495E]">{t("auditHub.engagementsOutbox")}</h3>
          {outbox.length === 0 ? (
            <p className="mt-1 text-xs text-[#7F8C8D]">{t("auditHub.engagementsOutboxEmpty")}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {outbox.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#F3F4F6] px-3 py-2"
                >
                  <div>
                    <div className="font-mono text-[11px]">{row.id}</div>
                    <div className="text-[#7F8C8D]">
                      {row.status} · {row.inviteeEmail ?? row.inviteeUserId ?? "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void revokeInvite(row.id)}
                  >
                    {t("auditHub.engagementsRevoke")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
