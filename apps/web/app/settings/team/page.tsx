"use client";

import { Loader2, Trash2, X, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useSearchParams } from "next/navigation";
import {
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  INPUT_BORDERED_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useAuth } from "../../../lib/auth-context";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";

type MemberRow = {
  userId: string;
  organizationId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
};

type AccessReq = {
  id: string;
  createdAt: string;
  message: string | null;
  requester: { id: string; email: string; fullName: string | null };
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  invitedBy?: { id: string; email: string; fullName: string | null } | null;
};

function roleBadgeVariant(role: string): "owner" | "admin" | "accountant" | "user" {
  switch (role) {
    case "OWNER":
      return "owner";
    case "ADMIN":
      return "admin";
    case "ACCOUNTANT":
      return "accountant";
    default:
      return "user";
  }
}

function memberDisplayName(m: MemberRow): string {
  const n = m.user.fullName?.trim();
  if (n) return n;
  const emailLocal = m.user.email?.split("@")[0] ?? "";
  return emailLocal || "—";
}

const DEFAULT_TEAM_INVITE_ROLES = ["USER", "ACCOUNTANT", "DIRECTOR", "ADMIN"] as const;

export default function TeamSettingsPage() {
  const { t } = useTranslation();
  const search = useSearchParams();
  const { ready, token } = useRequireAuth();
  const { user, refreshSession } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [requests, setRequests] = useState<AccessReq[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("USER");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<string[]>(() => [
    ...DEFAULT_TEAM_INVITE_ROLES,
  ]);
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const canManage =
    user?.role === "OWNER" || user?.role === "ADMIN";

  const load = useCallback(async () => {
    if (!token) return;
    setLoadErr(null);
    const res = await apiFetch("/api/team/members");
    if (!res.ok) {
      setLoadErr(String(res.status));
      return;
    }
    const data = (await res.json()) as MemberRow[];
    setMembers(data);

    if (canManage) {
      const r = await apiFetch("/api/team/access-requests");
      if (r.ok) {
        setRequests((await r.json()) as AccessReq[]);
      } else {
        setRequests([]);
      }
    } else {
      setRequests([]);
    }
    if (canManage) {
      const inv = await apiFetch("/api/team/invites");
      if (inv.ok) {
        setInvites((await inv.json()) as InviteRow[]);
      } else {
        setInvites([]);
      }
    } else {
      setInvites([]);
    }
  }, [token, canManage]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  useEffect(() => {
    if (!ready || !token) return;
    void (async () => {
      const res = await apiFetch("/api/system/team-assignable-roles");
      if (!res.ok) return;
      const body = (await res.json()) as { roles?: unknown };
      if (!Array.isArray(body.roles)) return;
      const roles = body.roles.filter((r): r is string => typeof r === "string" && r.length > 0);
      if (roles.length > 0) {
        setAssignableRoles(roles);
        setInviteRole((cur) => (roles.includes(cur) ? cur : roles[0]!));
      }
    })();
  }, [ready, token]);

  useEffect(() => {
    if (!ready || !token) return;
    const tokenParam = search.get("invite");
    if (!tokenParam) return;
    void (async () => {
      const res = await apiFetch("/api/auth/invites/accept-by-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenParam }),
      });
      if (!res.ok) {
        setInviteMsg(`${t("teamPage.inviteAcceptErr", { defaultValue: "Не удалось принять приглашение" })}: ${res.status}`);
        return;
      }
      setInviteMsg(t("teamPage.inviteAcceptOk", { defaultValue: "Приглашение принято. Членство добавлено." }));
      await load();
      await refreshSession();
    })();
  }, [ready, token, search, load, refreshSession, t]);

  async function removeMember(targetUserId: string) {
    if (!canManage) return;
    if (!window.confirm(t("teamPage.removeConfirm"))) return;
    setBusyId(targetUserId);
    try {
      const res = await apiFetch(`/api/team/members/${targetUserId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(txt || String(res.status));
        return;
      }
      await load();
      await refreshSession();
    } finally {
      setBusyId(null);
    }
  }

  async function approveRequest(id: string, role: string) {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/team/access-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(txt || String(res.status));
        return;
      }
      await load();
      await refreshSession();
    } finally {
      setBusyId(null);
    }
  }

  async function declineRequest(id: string) {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/team/access-requests/${id}/decline`, {
        method: "POST",
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(txt || String(res.status));
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setInviteMsg(null);
    setBusyId("invite");
    try {
      const res = await apiFetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setInviteMsg(txt || String(res.status));
        return;
      }
      setInviteEmail("");
      setInviteMsg(t("teamPage.inviteOk"));
      setInviteModalOpen(false);
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!canManage) return;
    setBusyId(inviteId);
    try {
      const res = await apiFetch(`/api/team/invites/${inviteId}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const txt = await res.text();
        setInviteMsg(txt || String(res.status));
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!ready || !token) {
    return <div className="text-sm text-gray-500">{t("common.loading")}</div>;
  }

  if (user?.role === "USER") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t("teamPage.noAccess")}
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <PageHeader
        title={t("teamPage.title")}
        subtitle={t("teamPage.subtitle")}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              className="inline-flex items-center gap-2"
              onClick={() => {
                setInviteMsg(null);
                setInviteModalOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              {t("teamPage.inviteOpen")}
            </Button>
          ) : null
        }
      />

      {inviteModalOpen && canManage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`} role="dialog" aria-modal="true">
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
                {t("teamPage.inviteTitle")}
              </h3>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setInviteModalOpen(false)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </header>
            <form
              onSubmit={(e) => void sendInvite(e)}
              className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto"
            >
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("teamPage.email")}
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("teamPage.role")}
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              {inviteMsg ? <p className="text-[13px] text-[#7F8C8D]">{inviteMsg}</p> : null}
              <div className={MODAL_FOOTER_ACTIONS_CLASS}>
                <Button
                  type="button"
                  variant="outline"
                  className={MODAL_FOOTER_BUTTON_CLASS}
                  onClick={() => setInviteModalOpen(false)}
                  disabled={busyId === "invite"}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className={MODAL_FOOTER_BUTTON_CLASS}
                  disabled={busyId === "invite"}
                >
                  {busyId === "invite" ? "…" : t("teamPage.inviteSubmit")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {loadErr && (
        <p className="text-red-600 text-sm">{loadErr}</p>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2 border-b border-[#D5DADF] pb-2">
          <button
            type="button"
            onClick={() => setTab("members")}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
              tab === "members"
                ? "border-[#2980B9] bg-white text-[#34495E] shadow-sm"
                : "border-transparent text-[#7F8C8D] hover:border-[#D5DADF]"
            }`}
          >
            {t("teamPage.membersTitle")}
          </button>
          <button
            type="button"
            onClick={() => setTab("invites")}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
              tab === "invites"
                ? "border-[#2980B9] bg-white text-[#34495E] shadow-sm"
                : "border-transparent text-[#7F8C8D] hover:border-[#D5DADF]"
            }`}
          >
            {t("teamPage.invitesTab", { defaultValue: "Приглашения" })}
          </button>
        </div>
      )}

      {canManage && requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-gray-900">{t("teamPage.requestsTitle")}</h2>
          <ul className="space-y-2">
            {requests.map((req) => (
              <li
                key={req.id}
                className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 flex flex-wrap gap-3 items-center justify-between"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {req.requester.fullName || req.requester.email}
                  </div>
                  <div className="text-xs text-gray-600">{req.requester.email}</div>
                  {req.message && (
                    <div className="text-sm text-gray-700 mt-1">{req.message}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <ApproveRoleSelect
                    roles={assignableRoles}
                    onApprove={(role) => void approveRequest(req.id, role)}
                    disabled={busyId === req.id}
                  />
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => void declineRequest(req.id)}
                    className={`${SECONDARY_BUTTON_CLASS} px-3 py-1.5 text-[13px]`}
                  >
                    {t("teamPage.decline")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "members" && (
      <section className="space-y-3">
        <h2 className="text-lg font-medium text-gray-900">{t("teamPage.membersTitle")}</h2>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("teamPage.memberName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("teamPage.email")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("teamPage.role")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("teamPage.status")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("teamPage.joined")}</th>
                {canManage && (
                  <th className={DATA_TABLE_ACTIONS_TH_CLASS}>{t("teamPage.actions")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>{memberDisplayName(m)}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>{m.user.email}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>
                    <Badge variant={roleBadgeVariant(m.role)}>{m.role}</Badge>
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>
                    <Badge variant="success">{t("teamPage.statusActive")}</Badge>
                  </td>
                  <td className={`${DATA_TABLE_TD_RIGHT_CLASS} text-[13px]`}>
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className={`${DATA_TABLE_ACTIONS_TD_CLASS} text-[13px]`}>
                      {m.role !== "OWNER" && m.userId !== user?.id ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="inline-flex items-center gap-2 text-[13px] text-[#B71C1C] border-[#EF9A9A] hover:bg-[#FFEBEE]"
                            disabled={busyId === m.userId}
                            onClick={() => void removeMember(m.userId)}
                          >
                            {busyId === m.userId ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                                {t("common.loading")}
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                                {t("teamPage.remove")}
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[#7F8C8D]">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {canManage && tab === "invites" && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-gray-900">
            {t("teamPage.invitesTab", { defaultValue: "Приглашения" })}
          </h2>
          {invites.length === 0 ? (
            <p className="text-sm text-slate-600">
              {t("teamPage.invitesEmpty", { defaultValue: "Активных приглашений нет." })}
            </p>
          ) : (
            <ul className="space-y-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-3 items-center justify-between"
                >
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{inv.email}</div>
                    <div className="text-xs text-slate-600">
                      {inv.role} · {new Date(inv.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === inv.id}
                    onClick={() => void revokeInvite(inv.id)}
                  >
                    {t("teamPage.revokeInvite", { defaultValue: "Отозвать" })}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ApproveRoleSelect({
  roles,
  onApprove,
  disabled,
}: {
  roles: string[];
  onApprove: (role: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [role, setRole] = useState(() => roles[0] ?? "USER");

  useEffect(() => {
    setRole((cur) => (roles.includes(cur) ? cur : roles[0] ?? "USER"));
  }, [roles]);

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className={`${INPUT_BORDERED_CLASS} py-1.5 text-[13px]`}
        disabled={disabled}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onApprove(role)}
        className={`${PRIMARY_BUTTON_CLASS} px-3 py-1.5 text-[13px] disabled:opacity-50`}
      >
        {t("teamPage.approve")}
      </button>
    </div>
  );
}
