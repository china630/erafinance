"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import {
  AUDIT_ENGAGEMENT_INVITE_ID_KEY,
  AUDIT_ENGAGEMENT_TOKEN_KEY,
} from "../../lib/session-keys";
import { useAuditEngagementSession } from "../../lib/audit-engagement-session";
import { useRequireAuth } from "../../lib/use-require-auth";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../lib/design-system";

type InboxRow = {
  id: string;
  status: string;
  targetOrganizationId: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  permissions: unknown;
  targetOrganization?: { name: string };
};

export default function AuditInvitationsPage() {
  const { t } = useTranslation();
  useRequireAuth();
  const engagement = useAuditEngagementSession();
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [acceptId, setAcceptId] = useState("");
  const [acceptToken, setAcceptToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionInviteId, setSessionInviteId] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [acceptConsent, setAcceptConsent] = useState(false);
  const [declineId, setDeclineId] = useState("");
  const [declineToken, setDeclineToken] = useState("");
  const [declineBusy, setDeclineBusy] = useState(false);

  const loadInbox = useCallback(async () => {
    setErr(null);
    const res = await apiFetch("/api/audit-hub/me/audit-invites/inbox");
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    const data = (await res.json()) as InboxRow[];
    setInbox(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function accept() {
    if (!acceptConsent) {
      setErr(t("auditHub.invitationsConsentRequired"));
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await apiFetch(
      `/api/audit-hub/me/audit-invites/${encodeURIComponent(acceptId.trim())}/accept`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: acceptToken.trim() }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setAcceptToken("");
    setAcceptConsent(false);
    await loadInbox();
    void engagement.refresh();
  }

  function startSession() {
    sessionStorage.setItem(AUDIT_ENGAGEMENT_INVITE_ID_KEY, sessionInviteId.trim());
    sessionStorage.setItem(AUDIT_ENGAGEMENT_TOKEN_KEY, sessionToken.trim());
    void engagement.refresh().then(() => {
      window.location.href = "/audit-hub";
    });
  }

  async function decline() {
    setDeclineBusy(true);
    setErr(null);
    const res = await apiFetch(
      `/api/audit-hub/me/audit-invites/${encodeURIComponent(declineId.trim())}/decline`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: declineToken.trim() }),
      },
    );
    setDeclineBusy(false);
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setDeclineToken("");
    await loadInbox();
  }

  function clearSession() {
    sessionStorage.removeItem(AUDIT_ENGAGEMENT_INVITE_ID_KEY);
    sessionStorage.removeItem(AUDIT_ENGAGEMENT_TOKEN_KEY);
    void engagement.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#2C3E50]">{t("auditHub.invitationsTitle")}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("auditHub.invitationsSubtitle")}</p>
      </div>

      {engagement.phase === "active" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {t("auditHub.invitationsActiveHint", { org: engagement.organizationName })}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/audit-hub"
              className={`${PRIMARY_BUTTON_CLASS} inline-block text-center no-underline`}
            >
              {t("auditHub.invitationsOpenHub")}
            </Link>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => clearSession()}>
              {t("auditHub.externalExit")}
            </button>
          </div>
        </div>
      ) : null}

      {engagement.phase === "invalid" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {t("auditHub.invitationsInvalidSession")}
        </div>
      ) : null}

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#34495E]">{t("auditHub.invitationsInbox")}</h2>
        {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
        {inbox.length === 0 ? (
          <p className="mt-2 text-xs text-[#7F8C8D]">{t("auditHub.invitationsEmpty")}</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {inbox.map((row) => (
              <li
                key={row.id}
                className="rounded border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2"
              >
                <div className="font-medium text-[#2C3E50]">
                  {row.targetOrganization?.name ?? row.targetOrganizationId}
                </div>
                <div className="mt-1 text-[#7F8C8D]">
                  {t("auditHub.invitationsStatus")}: {row.status} · {row.id}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#34495E]">{t("auditHub.invitationsAccept")}</h2>
        <p className="mt-1 text-xs text-[#7F8C8D]">{t("auditHub.invitationsAcceptHint")}</p>
        <div className="mt-3 space-y-2">
          <input
            className="w-full rounded border border-[#D1D5DB] p-2 text-xs"
            placeholder={t("auditHub.invitationsInviteIdPh")}
            value={acceptId}
            onChange={(e) => setAcceptId(e.target.value)}
          />
          <input
            className="w-full rounded border border-[#D1D5DB] p-2 text-xs font-mono"
            placeholder={t("auditHub.invitationsTokenPh")}
            value={acceptToken}
            onChange={(e) => setAcceptToken(e.target.value)}
          />
          <p className="text-[11px] leading-relaxed text-[#5D6D7E]">{t("auditHub.invitationsConsentText")}</p>
          <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[#34495E]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acceptConsent}
              onChange={(e) => setAcceptConsent(e.target.checked)}
            />
            <span>{t("auditHub.invitationsConsentCheckbox")}</span>
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !acceptId.trim() || !acceptToken.trim() || !acceptConsent}
            onClick={() => void accept()}
          >
            {t("auditHub.invitationsAcceptBtn")}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#34495E]">{t("auditHub.invitationsDeclineTitle")}</h2>
        <p className="mt-1 text-xs text-[#7F8C8D]">{t("auditHub.invitationsDeclineHint")}</p>
        <div className="mt-3 space-y-2">
          <input
            className="w-full rounded border border-[#D1D5DB] p-2 text-xs"
            placeholder={t("auditHub.invitationsInviteIdPh")}
            value={declineId}
            onChange={(e) => setDeclineId(e.target.value)}
          />
          <input
            className="w-full rounded border border-[#D1D5DB] p-2 text-xs font-mono"
            placeholder={t("auditHub.invitationsTokenPh")}
            value={declineToken}
            onChange={(e) => setDeclineToken(e.target.value)}
          />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={declineBusy || !declineId.trim() || !declineToken.trim()}
            onClick={() => void decline()}
          >
            {t("auditHub.invitationsDeclineBtn")}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#34495E]">{t("auditHub.invitationsStartSession")}</h2>
        <p className="mt-1 text-xs text-[#7F8C8D]">{t("auditHub.invitationsStartSessionHint")}</p>
        <div className="mt-3 space-y-2">
          <input
            className="w-full rounded border border-[#D1D5DB] p-2 text-xs"
            placeholder={t("auditHub.invitationsInviteIdPh")}
            value={sessionInviteId}
            onChange={(e) => setSessionInviteId(e.target.value)}
          />
          <input
            className="w-full rounded border border-[#D1D5DB] p-2 text-xs font-mono"
            placeholder={t("auditHub.invitationsTokenPh")}
            value={sessionToken}
            onChange={(e) => setSessionToken(e.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!sessionInviteId.trim() || !sessionToken.trim()}
            onClick={() => startSession()}
          >
            {t("auditHub.invitationsStartSessionBtn")}
          </button>
        </div>
      </section>
    </div>
  );
}
