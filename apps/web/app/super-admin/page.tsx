"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogIn, Pencil, Trash2, X } from "lucide-react";
import { EmptyState } from "../../components/empty-state";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";
import { LandingModulesEditor } from "../../components/super-admin/landing-modules-editor";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_CENTER_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_MONO_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";

type Tab =
  | "dashboard"
  | "orgs"
  | "users"
  | "subs"
  | "i18n"
  | "logs"
  | "earlyAccess"
  | "landing";

const MODULE_SLUG_PRESETS = [
  "production",
  "manufacturing",
  "fixed_assets",
  "ifrs",
  "banking_pro",
  "hr_full",
] as const;

const INDUSTRY_MODULE_SLUG_PRESETS = [
  "industry_retail_ecom",
  "industry_logistics_customs",
  "industry_construction",
  "industry_crm_whatsapp",
] as const;

const ALL_MODULE_SLUG_PRESETS = [
  ...MODULE_SLUG_PRESETS,
  ...INDUSTRY_MODULE_SLUG_PRESETS,
] as const;

/** ISO из БД (UTC) → YYYY-MM-DD для input type="date" без сдвига календарного дня. */
function isoToDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addOneYearFromTodayDateInput(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function roleLabel(role: string, t: TFunction): string {
  if (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "ACCOUNTANT" ||
    role === "USER"
  ) {
    return t(`superAdmin.role${role}`);
  }
  return role;
}

function earlyAccessModuleLabel(moduleKey: string, t: TFunction): string {
  switch (moduleKey) {
    case "RETAIL_ECOM":
      return t("nav.industryRetailEcom");
    case "LOGISTICS_CUSTOMS":
      return t("nav.industryLogisticsCustoms");
    case "CONSTRUCTION":
      return t("nav.industryConstruction");
    case "CRM_WHATSAPP":
      return t("nav.industryCrmWhatsapp");
    default:
      return moduleKey;
  }
}

type OrgSubscription = {
  tier: string;
  isTrial: boolean;
  isBlocked: boolean;
  expiresAt: string | null;
  activeModules?: string[];
};

type OrgRow = {
  id: string;
  name: string;
  taxId: string;
  primaryUserId: string | null;
  subscription: OrgSubscription | null;
};

type UserOrgItem = {
  organizationId: string;
  organizationName: string;
  taxId: string;
  role: string;
  joinedAt: string;
  subscription: OrgSubscription | null;
};

export default function SuperAdminPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, ready, token, refreshSession, impersonateAsUser } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<{
    totalOrganizations: number;
    revenueTotalAzn: string;
    newUsers24h: number;
    activeTrials: number;
  } | null>(null);
  const [orgQ, setOrgQ] = useState("");
  const [orgPage, setOrgPage] = useState(1);
  const [usersQ, setUsersQ] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [users, setUsers] = useState<{
    total: number;
    items: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      fullName: string | null;
      isSuperAdmin: boolean;
      membershipCount: number;
      createdAt: string;
    }>;
  } | null>(null);
  const [orgs, setOrgs] = useState<{
    total: number;
    items: OrgRow[];
  } | null>(null);
  const [partners, setPartners] = useState<
    Array<{
      id: string;
      code: string;
      displayName: string;
      isCorporate: boolean;
      fixedRatePercent: unknown;
      ownerUserId: string | null;
      _count: { referrals: number };
    }>
  | null>(null);
  const [partnersLoad, setPartnersLoad] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [subTrial, setSubTrial] = useState(false);
  const [i18nLocale, setI18nLocale] = useState("az");
  const [i18nQ, setI18nQ] = useState("");
  const [i18nRows, setI18nRows] = useState<
    Array<{
      id: string | null;
      key: string;
      value: string;
      isOverride?: boolean;
    }>
  >([]);
  const [i18nTotal, setI18nTotal] = useState<number | null>(null);
  const [i18nKey, setI18nKey] = useState("");
  const [i18nVal, setI18nVal] = useState("");
  const [logOrg, setLogOrg] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<{
    total: number;
    items: Array<{
      id: string;
      organizationId: string | null;
      action: string;
      entityType: string;
      createdAt: string;
    }>;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [eaSummary, setEaSummary] = useState<
    Array<{
      moduleKey: string;
      signupsCount: number;
      viewersCount: number;
      conversionRate: number;
      medianModalCloseMs: number | null;
      firstSignupAt: string | null;
      signupsPerHour: number;
      thresholdsHit: number[];
      speedRank: number;
    }>
  | null>(null);
  const [eaEvents, setEaEvents] = useState<{
    total: number;
    page: number;
    pageSize: number;
    items: Array<{
      id: string;
      moduleKey: string;
      eventType: string;
      userEmail: string | null;
      organizationName: string | null;
      durationMs: number | null;
      createdAt: string;
    }>;
  } | null>(null);
  const [eaLoading, setEaLoading] = useState(false);
  const [subModalOrg, setSubModalOrg] = useState<OrgRow | null>(null);
  const [subTier, setSubTier] = useState<
    "TIER_1" | "TIER_2" | "TIER_3"
  >("TIER_1");
  const [subExpires, setSubExpires] = useState("");
  const [subBlocked, setSubBlocked] = useState(false);
  const [subPreset, setSubPreset] = useState<Record<string, boolean>>({});
  const [subExtra, setSubExtra] = useState("");
  const [subSaving, setSubSaving] = useState(false);

  const [userOrgsUserId, setUserOrgsUserId] = useState<string | null>(null);
  const [userOrgsData, setUserOrgsData] = useState<{
    userId: string;
    email: string;
    items: UserOrgItem[];
  } | null>(null);
  const [userOrgsLoading, setUserOrgsLoading] = useState(false);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const res = await apiFetch("/api/admin/stats");
    if (!res.ok) {
      setErr(`${res.status}`);
      return;
    }
    setStats(await res.json());
  }, [token]);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const q = new URLSearchParams({
      page: String(orgPage),
      pageSize: "20",
    });
    if (orgQ.trim()) q.set("q", orgQ.trim());
    const res = await apiFetch(`/api/admin/organizations?${q}`);
    if (!res.ok) {
      setErr(`${res.status}`);
      return;
    }
    setOrgs((await res.json()) as { total: number; items: OrgRow[] });
  }, [token, orgPage, orgQ]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const q = new URLSearchParams({
      page: String(usersPage),
      pageSize: "20",
    });
    if (usersQ.trim()) q.set("q", usersQ.trim());
    const res = await apiFetch(`/api/admin/users?${q}`);
    if (!res.ok) {
      setErr(`${res.status}`);
      return;
    }
    setUsers(await res.json());
  }, [token, usersPage, usersQ]);

  const loadPartners = useCallback(async () => {
    if (!token) return;
    setPartnersLoad(true);
    try {
      const res = await apiFetch("/api/admin/referrals/partners");
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: `HTTP ${res.status}` });
        setPartners(null);
        return;
      }
      setPartners(await res.json());
    } finally {
      setPartnersLoad(false);
    }
  }, [token, t]);

  const loadI18n = useCallback(async () => {
    if (!token) return;
    const q = new URLSearchParams({ locale: i18nLocale, take: "20000" });
    if (i18nQ.trim()) q.set("q", i18nQ.trim());
    const res = await apiFetch(`/api/admin/translations?${q}`);
    if (!res.ok) return;
    const data = await res.json();
    setI18nRows(data.items ?? []);
    setI18nTotal(typeof data.total === "number" ? data.total : null);
  }, [token, i18nLocale, i18nQ]);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    const q = new URLSearchParams({ take: "50" });
    if (logOrg.trim()) q.set("organizationId", logOrg.trim());
    const res = await apiFetch(`/api/admin/audit-logs?${q}`);
    if (!res.ok) return;
    setLogs(await res.json());
  }, [token, logOrg]);

  const loadEarlyAccess = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setEaLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        apiFetch("/api/admin/early-access/summary"),
        apiFetch("/api/admin/early-access/events?page=1&pageSize=50"),
      ]);
      if (!sRes.ok) {
        setErr(`${sRes.status}`);
        setEaSummary(null);
        setEaEvents(null);
        return;
      }
      setEaSummary(
        (await sRes.json()) as Array<{
          moduleKey: string;
          signupsCount: number;
          viewersCount: number;
          conversionRate: number;
          medianModalCloseMs: number | null;
          firstSignupAt: string | null;
          signupsPerHour: number;
          thresholdsHit: number[];
          speedRank: number;
        }>,
      );
      if (eRes.ok) {
        setEaEvents(
          (await eRes.json()) as {
            total: number;
            page: number;
            pageSize: number;
            items: Array<{
              id: string;
              moduleKey: string;
              eventType: string;
              userEmail: string | null;
              organizationName: string | null;
              durationMs: number | null;
              createdAt: string;
            }>;
          },
        );
      } else {
        setEaEvents(null);
      }
    } finally {
      setEaLoading(false);
    }
  }, [token]);

  const openSubModal = useCallback((o: OrgRow) => {
    setSubModalOrg(o);
    const sub = o.subscription;
    const raw = sub?.tier;
    const tier =
      raw === "TIER_2" || raw === "TIER_3" ? raw : "TIER_1";
    setSubTier(tier);
    let exp = isoToDateInputValue(sub?.expiresAt);
    if (!exp && tier === "TIER_3") {
      exp = addOneYearFromTodayDateInput();
    }
    setSubExpires(exp);
    setSubBlocked(sub?.isBlocked ?? false);
    setSubTrial(sub?.isTrial ?? false);
    const mods = new Set(sub?.activeModules ?? []);
    const preset: Record<string, boolean> = {};
    for (const s of ALL_MODULE_SLUG_PRESETS) {
      preset[s] = mods.has(s);
    }
    setSubPreset(preset);
    const extraMods = (sub?.activeModules ?? []).filter(
      (m) =>
        !ALL_MODULE_SLUG_PRESETS.includes(
          m as (typeof ALL_MODULE_SLUG_PRESETS)[number],
        ),
    );
    setSubExtra(extraMods.join(", "));
  }, []);

  const saveSubscription = useCallback(async () => {
    if (!token || !subModalOrg) return;
    setSubSaving(true);
    setErr(null);
    const fromPresets = ALL_MODULE_SLUG_PRESETS.filter((s) => subPreset[s]);
    const extra = subExtra
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const activeModules = [...new Set([...fromPresets, ...extra])];
    const expiresAt =
      subExpires.trim() === ""
        ? null
        : new Date(`${subExpires.trim()}T12:00:00.000Z`).toISOString();
    const res = await apiFetch(
      `/api/admin/organizations/${subModalOrg.id}/subscription`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: subTier,
          expiresAt,
          isBlocked: subBlocked,
          isTrial: subTrial,
          activeModules,
        }),
      },
    );
    setSubSaving(false);
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      toast.error(t("common.saveErr"), { description: msg || `${res.status}` });
      setErr(`${res.status}`);
      return;
    }
    toast.success(t("common.save"));
    setSubModalOrg(null);
    void loadOrgs();
  }, [
    token,
    subModalOrg,
    subTier,
    subExpires,
    subBlocked,
    subTrial,
    subPreset,
    subExtra,
    loadOrgs,
  ]);

  const openUserOrgsModal = useCallback(
    async (userId: string) => {
      if (!token) return;
      setUserOrgsUserId(userId);
      setUserOrgsData(null);
      setUserOrgsLoading(true);
      setErr(null);
      const res = await apiFetch(`/api/admin/users/${userId}/organizations`);
      setUserOrgsLoading(false);
      if (!res.ok) {
        setErr(`${res.status}`);
        setUserOrgsUserId(null);
        return;
      }
      setUserOrgsData(await res.json());
    },
    [token],
  );

  useEffect(() => {
    if (!ready || !token || !user?.isSuperAdmin) return;
    if (tab === "dashboard") void loadStats();
  }, [ready, token, user?.isSuperAdmin, tab, loadStats]);

  useEffect(() => {
    if (!ready || !token || !user?.isSuperAdmin) return;
    if (tab === "orgs") void loadOrgs();
  }, [ready, token, user?.isSuperAdmin, tab, loadOrgs]);

  useEffect(() => {
    if (!ready || !token || !user?.isSuperAdmin) return;
    if (tab === "users") void loadUsers();
  }, [ready, token, user?.isSuperAdmin, tab, loadUsers]);

  useEffect(() => {
    if (!ready || !token || !user?.isSuperAdmin) return;
    if (tab === "subs") void loadPartners();
  }, [ready, token, user?.isSuperAdmin, tab, loadPartners]);

  useEffect(() => {
    if (!ready || !token || !user?.isSuperAdmin) return;
    if (tab === "i18n") void loadI18n();
  }, [ready, token, user?.isSuperAdmin, tab, loadI18n]);

  useEffect(() => {
    if (!ready || !token || !user?.isSuperAdmin) return;
    if (tab === "logs") void loadLogs();
  }, [ready, token, user?.isSuperAdmin, tab, loadLogs]);

  useEffect(() => {
    if (!ready || !token || !user?.isSuperAdmin) return;
    if (tab === "earlyAccess") void loadEarlyAccess();
  }, [ready, token, user?.isSuperAdmin, tab, loadEarlyAccess]);

  if (!ready) {
    return (
      <div className="text-sm text-gray-500 py-12 text-center">
        {t("common.loading")}
      </div>
    );
  }

  if (!token || !user?.isSuperAdmin) {
    return (
      <EmptyState
        title={t("superAdmin.forbidden")}
        className="border-solid border-[#D5DADF] bg-white"
      />
    );
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setTab(id)}
      className={[
        "px-3 py-2 rounded-lg text-[13px] font-medium transition",
        tab === id
          ? "bg-[#2980B9] text-white shadow-sm ring-2 ring-[#2980B9] ring-offset-1"
          : "bg-white border border-[#D5DADF] text-[#34495E] hover:bg-[#F8F9FA]",
      ].join(" ")}
    >
      {label}
    </button>
  );

  const fmtExpires = (iso: string | null | undefined) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
    } catch {
      return "—";
    }
  };

  const fmtModules = (m: string[] | undefined): string =>
    m && m.length > 0 ? m.join(", ") : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#34495E]">
          {t("superAdmin.pageTitle")}
        </h1>
        <p className="text-[13px] text-[#7F8C8D] mt-1">{user.email}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabBtn("dashboard", t("superAdmin.tabDashboard"))}
        {tabBtn("orgs", t("superAdmin.tabOrganizations"))}
        {tabBtn("users", t("superAdmin.tabUsers"))}
        {tabBtn("subs", t("superAdmin.tabSubscriptions"))}
        {tabBtn("i18n", t("superAdmin.tabLocalization"))}
        {tabBtn("logs", t("superAdmin.tabLogs"))}
        {tabBtn("earlyAccess", t("superAdmin.tabEarlyAccess"))}
        {tabBtn("landing", t("superAdmin.tabLanding"))}
      </div>
      <p className="text-[13px] text-[#2980B9] flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/super-admin/data" className="underline font-medium">
          {t("superAdmin.dataHubLink")}
        </Link>
        <Link href="/super-admin/data/customs-tariffs" className="underline font-medium">
          {t("trade.customs.tariffRatesTitle")}
        </Link>
      </p>

      {err ? (
        <EmptyState
          title={t("common.apiErrorTitle")}
          description={`API ${err}`}
        />
      ) : null}

      {tab === "dashboard" && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            [t("superAdmin.statsOrganizations"), String(stats.totalOrganizations)],
            [t("superAdmin.statsRevenue"), stats.revenueTotalAzn],
            [t("superAdmin.statsNewUsers"), String(stats.newUsers24h)],
            [t("superAdmin.statsTrials"), String(stats.activeTrials)],
          ].map(([k, v]) => (
            <div key={k} className={`${CARD_CONTAINER_CLASS} p-4`}>
              <div className="text-xs font-semibold uppercase text-[#7F8C8D]">
                {k}
              </div>
              <div className="text-2xl font-bold text-[#34495E] mt-1 tabular-nums text-right">
                {v}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "orgs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className={`${MODAL_INPUT_CLASS} min-w-[200px]`}
              placeholder={t("superAdmin.searchVoen")}
              value={orgQ}
              onChange={(e) => setOrgQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setOrgPage(1);
                  void loadOrgs();
                }
              }}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setOrgPage(1);
                void loadOrgs();
              }}
            >
              {t("superAdmin.search")}
            </button>
          </div>
          {orgs && (
            <>
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.orgColVoen")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.orgColName")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.orgColTier")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("superAdmin.orgColExpires")}</th>
                    <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("superAdmin.orgColTrial")}</th>
                    <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("superAdmin.orgColBlocked")}</th>
                    <th className={DATA_TABLE_ACTIONS_TH_CLASS}>{t("superAdmin.orgColActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.items.map((o) => (
                    <tr key={o.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{o.taxId}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>{o.name}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {o.subscription
                          ? o.subscription.tier
                          : "—"}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {fmtExpires(o.subscription?.expiresAt)}
                      </td>
                      <td className={DATA_TABLE_TD_CENTER_CLASS}>
                        {o.subscription?.isTrial
                          ? t("common.yes")
                          : t("common.no")}
                      </td>
                      <td className={DATA_TABLE_TD_CENTER_CLASS}>
                        {o.subscription?.isBlocked
                          ? t("common.yes")
                          : t("common.no")}
                      </td>
                      <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={`${TABLE_ROW_ICON_BTN_CLASS} text-[#7F8C8D]`}
                            title={t("superAdmin.orgEditSubscription")}
                            onClick={() => openSubModal(o)}
                          >
                            <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                          </button>
                          {o.primaryUserId ? (
                            <button
                              type="button"
                              className={`${TABLE_ROW_ICON_BTN_CLASS} text-[#2980B9]`}
                              title={t("superAdmin.loginAs")}
                              onClick={() => {
                                void impersonateAsUser(o.primaryUserId!).then(() =>
                                  router.push("/"),
                                );
                              }}
                            >
                              <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              <div className="mt-2 flex justify-between rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-4 py-2 text-xs text-[#7F8C8D]">
                <span>{t("superAdmin.totalLabel", { count: orgs.total })}</span>
                <span>
                  <button
                    type="button"
                    className="text-action disabled:opacity-40"
                    disabled={orgPage <= 1}
                    onClick={() => setOrgPage((p) => Math.max(1, p - 1))}
                  >
                    {t("superAdmin.prev")}
                  </button>
                  <span className="mx-2">
                    {t("superAdmin.pageLabel", { page: orgPage })}
                  </span>
                  <button
                    type="button"
                    className="text-action disabled:opacity-40"
                    disabled={orgPage * 20 >= orgs.total}
                    onClick={() => setOrgPage((p) => p + 1)}
                  >
                    {t("superAdmin.next")}
                  </button>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className={`${MODAL_INPUT_CLASS} min-w-[200px]`}
              placeholder={t("superAdmin.searchUsers")}
              value={usersQ}
              onChange={(e) => setUsersQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setUsersPage(1);
                  void loadUsers();
                }
              }}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setUsersPage(1);
                void loadUsers();
              }}
            >
              {t("superAdmin.search")}
            </button>
          </div>
          {users && (
            <>
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.usersColEmail")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.usersColName")}</th>
                    <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("superAdmin.usersColSuper")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("superAdmin.usersColOrgs")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                      {t("superAdmin.usersColCreated")}
                    </th>
                    <th className={DATA_TABLE_ACTIONS_TH_CLASS} />
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((u) => (
                    <tr key={u.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>{u.email}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                        {[u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
                          u.fullName ||
                          "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CENTER_CLASS}>
                        {u.isSuperAdmin ? t("common.yes") : t("common.no")}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {u.membershipCount > 0 ? (
                          <button
                            type="button"
                            className={`${TABLE_ROW_ICON_BTN_CLASS} inline-flex min-w-[2.5rem] gap-1 text-[#2980B9]`}
                            title={t("superAdmin.userOrgsModalTitle")}
                            onClick={() => void openUserOrgsModal(u.id)}
                          >
                            <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="tabular-nums text-[12px] font-semibold">
                              {u.membershipCount}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[#7F8C8D]">0</span>
                        )}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {u.createdAt.slice(0, 19).replace("T", " ")}
                      </td>
                      <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                        <button
                          type="button"
                          className={`${TABLE_ROW_ICON_BTN_CLASS} text-[#2980B9]`}
                          title={t("superAdmin.loginAs")}
                          onClick={() => {
                            void impersonateAsUser(u.id).then(() =>
                              router.push("/"),
                            );
                          }}
                        >
                          <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              <div className="mt-2 flex justify-between rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-4 py-2 text-xs text-[#7F8C8D]">
                <span>
                  {t("superAdmin.totalLabel", { count: users.total })}
                </span>
                <span>
                  <button
                    type="button"
                    className="text-action disabled:opacity-40"
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                  >
                    {t("superAdmin.prev")}
                  </button>
                  <span className="mx-2">
                    {t("superAdmin.pageLabel", { page: usersPage })}
                  </span>
                  <button
                    type="button"
                    className="text-action disabled:opacity-40"
                    disabled={usersPage * 20 >= users.total}
                    onClick={() => setUsersPage((p) => p + 1)}
                  >
                    {t("superAdmin.next")}
                  </button>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "subs" && (
        <div className="space-y-6 max-w-4xl">

          <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
            <h2 className="text-sm font-bold text-[#34495E] uppercase tracking-wide">
              {t("superAdmin.billingNavTitle")}
            </h2>
            <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.billingNavHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/super-admin/billing/pricing" className={PRIMARY_BUTTON_CLASS}>
                {t("superAdmin.billingTabPricing")}
              </Link>
              <Link href="/super-admin/billing/quotas" className={SECONDARY_BUTTON_CLASS}>
                {t("superAdmin.billingTabQuotas")}
              </Link>
              <Link href="/super-admin/billing/packages" className={SECONDARY_BUTTON_CLASS}>
                {t("superAdmin.billingTabBundles")}
              </Link>
            </div>
          </div>

                <div className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
                  <h2 className="text-sm font-bold text-[#34495E] uppercase tracking-wide">
                    {t("superAdmin.referralsNewPartner")}
                  </h2>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="block text-sm text-[#34495E] flex-1 min-w-[200px]">
                      {t("superAdmin.referralsDisplayName")}
                      <input
                        className="mt-1 w-full border border-[#D5DADF] rounded-lg px-2 py-1.5 text-sm"
                        value={newPartnerName}
                        onChange={(e) => setNewPartnerName(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      onClick={async () => {
                        const displayName = newPartnerName.trim();
                        if (!displayName) return;
                        const res = await apiFetch("/api/admin/referrals/partners", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ displayName }),
                        });
                        if (!res.ok) {
                          toast.error(t("common.saveErr"), { description: `${res.status}` });
                          return;
                        }
                        toast.success(t("common.save"));
                        setNewPartnerName("");
                        void loadPartners();
                      }}
                    >
                      {t("superAdmin.referralsCreate")}
                    </button>
                  </div>
                </div>
                <div className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
                  <h2 className="text-sm font-bold text-[#34495E] uppercase tracking-wide">
                    {t("superAdmin.referralsPartnersList")}
                  </h2>
                  {partnersLoad ? (
                    <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>
                  ) : !partners || partners.length === 0 ? (
                    <p className="text-sm text-[#7F8C8D]">{t("superAdmin.referralsEmpty")}</p>
                  ) : (
                    <div className={DATA_TABLE_VIEWPORT_CLASS}>
                      <table className={DATA_TABLE_CLASS}>
                        <thead>
                          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                            <th className={DATA_TABLE_TH_LEFT_CLASS}>Code</th>
                            <th className={DATA_TABLE_TH_LEFT_CLASS}>Name</th>
                            <th className={DATA_TABLE_TH_RIGHT_CLASS}>Refs</th>
                            <th className={DATA_TABLE_ACTIONS_TH_CLASS} />
                          </tr>
                        </thead>
                        <tbody>
                          {partners.map((p) => (
                            <tr key={p.id} className={DATA_TABLE_TR_CLASS}>
                              <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{p.code}</td>
                              <td className={DATA_TABLE_TD_CLASS}>{p.displayName}</td>
                              <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                                {p._count?.referrals ?? 0}
                              </td>
                              <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                                <button
                                  type="button"
                                  className="text-sm text-[#2980B9] hover:underline"
                                  onClick={async () => {
                                    const res = await apiFetch(
                                      `/api/admin/referrals/partners/${p.id}/qr.png`,
                                    );
                                    if (!res.ok) {
                                      toast.error(t("common.saveErr"), {
                                        description: `${res.status}`,
                                      });
                                      return;
                                    }
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `partner-${p.code}.png`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                >
                                  {t("superAdmin.referralsQrDownload")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

        </div>
      )}

      {tab === "i18n" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <select
              className={MODAL_INPUT_CLASS}
              value={i18nLocale}
              onChange={(e) => setI18nLocale(e.target.value)}
            >
              <option value="az">az</option>
              <option value="ru">ru</option>
              <option value="en">en</option>
            </select>
            <input
              className={`${MODAL_INPUT_CLASS} flex-1 min-w-[160px]`}
              placeholder={t("superAdmin.i18nSearchPlaceholder")}
              value={i18nQ}
              onChange={(e) => setI18nQ(e.target.value)}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void loadI18n()}
            >
              {t("superAdmin.search")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={async () => {
                await apiFetch("/api/admin/translations/sync", {
                  method: "POST",
                });
              }}
            >
              {t("superAdmin.syncI18n")}
            </button>
            {i18nTotal !== null ? (
              <span className="text-xs text-gray-500 self-center">
                {t("superAdmin.i18nKeysCount", { count: i18nTotal })}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              className={`${MODAL_INPUT_CLASS} md:col-span-1`}
              placeholder={t("superAdmin.i18nFormKeyPlaceholder")}
              value={i18nKey}
              onChange={(e) => setI18nKey(e.target.value)}
            />
            <input
              className={`${MODAL_INPUT_CLASS} md:col-span-2`}
              placeholder={t("superAdmin.i18nFormValuePlaceholder")}
              value={i18nVal}
              onChange={(e) => setI18nVal(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={async () => {
              if (!i18nKey.trim()) return;
              await apiFetch("/api/admin/translations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  locale: i18nLocale,
                  key: i18nKey.trim(),
                  value: i18nVal,
                }),
              });
              setI18nKey("");
              setI18nVal("");
              void loadI18n();
            }}
          >
            {t("superAdmin.save")}
          </button>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.i18nColKey")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.i18nColValue")}</th>
                  <th className={DATA_TABLE_ACTIONS_TH_CLASS} />
                </tr>
              </thead>
              <tbody>
                {i18nRows.map((r) => (
                  <tr key={r.id ?? r.key} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>{r.key}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.value}</td>
                    <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                      {r.id ? (
                        <button
                          type="button"
                          className={`${TABLE_ROW_ICON_BTN_CLASS} text-[#E74C3C]`}
                          title={t("superAdmin.i18nRemoveOverrideTitle")}
                          onClick={async () => {
                            await apiFetch(`/api/admin/translations/${r.id}`, {
                              method: "DELETE",
                            });
                            void loadI18n();
                          }}
                        >
                          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                        </button>
                      ) : (
                        <span className="text-[12px] text-[#BDC3C7]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              className={`${MODAL_INPUT_CLASS} flex-1 min-w-[200px]`}
              placeholder={t("superAdmin.orgIdFilter")}
              value={logOrg}
              onChange={(e) => setLogOrg(e.target.value)}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void loadLogs()}
              disabled={logsLoading}
            >
              {t("superAdmin.search")}
            </button>
          </div>
          {logsLoading ? (
            <p className="text-sm text-[#7F8C8D]">{t("superAdmin.logsLoad")}</p>
          ) : null}
          {logs && (
            <>
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={`${DATA_TABLE_CLASS} text-xs`}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("superAdmin.logsColTime")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.logsColOrg")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.logsColAction")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.logsColEntity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.items.map((r) => (
                    <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_RIGHT_CLASS} text-xs whitespace-nowrap`}>
                        {r.createdAt}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                        {r.organizationId ?? "—"}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{r.action}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{r.entityType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              <div className="mt-2 rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-4 py-2 text-xs text-[#7F8C8D]">
                {t("superAdmin.logsTotal", { count: logs.total })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "earlyAccess" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[#34495E]">
              {t("superAdmin.earlyAccessTitle")}
            </h2>
            <p className="text-[13px] text-[#7F8C8D] mt-1 max-w-3xl">
              {t("superAdmin.earlyAccessSubtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void loadEarlyAccess()}
              disabled={eaLoading}
            >
              {t("common.refresh")}
            </button>
          </div>
          {eaLoading && !eaSummary ? (
            <p className="text-sm text-[#7F8C8D]">{t("superAdmin.earlyAccessLoad")}</p>
          ) : null}
          {eaSummary && eaSummary.length > 0 ? (
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={`${DATA_TABLE_CLASS} text-xs`}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>
                      {t("superAdmin.earlyAccessColModule")}
                    </th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                      {t("superAdmin.earlyAccessColSignups")}
                    </th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                      {t("superAdmin.earlyAccessColViewers")}
                    </th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                      {t("superAdmin.earlyAccessColConversion")}
                    </th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                      {t("superAdmin.earlyAccessColMedianMs")}
                    </th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                      {t("superAdmin.earlyAccessColSpeed")}
                    </th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                      {t("superAdmin.earlyAccessColRank")}
                    </th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>
                      {t("superAdmin.earlyAccessColThresholds")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {eaSummary.map((row) => (
                    <tr key={row.moduleKey} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>
                        {earlyAccessModuleLabel(row.moduleKey, t)}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{row.signupsCount}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{row.viewersCount}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {(row.conversionRate * 100).toFixed(1)}%
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {row.medianModalCloseMs != null
                          ? Math.round(row.medianModalCloseMs)
                          : "—"}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {row.signupsPerHour.toFixed(2)}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{row.speedRank}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.thresholdsHit.length
                          ? row.thresholdsHit.join(", ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !eaLoading ? (
            <p className="text-sm text-[#7F8C8D]">{t("superAdmin.earlyAccessEmpty")}</p>
          ) : null}

          <h3 className="text-sm font-semibold text-[#34495E]">
            {t("superAdmin.earlyAccessEventsTitle")}
          </h3>
          {eaEvents && eaEvents.items.length > 0 ? (
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={`${DATA_TABLE_CLASS} text-xs`}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>
                      {t("superAdmin.earlyAccessColTime")}
                    </th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>
                      {t("superAdmin.earlyAccessColModule")}
                    </th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>
                      {t("superAdmin.earlyAccessColEvent")}
                    </th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>
                      {t("superAdmin.earlyAccessColUser")}
                    </th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>
                      {t("superAdmin.earlyAccessColOrg")}
                    </th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                      {t("superAdmin.earlyAccessColDuration")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {eaEvents.items.map((r) => (
                    <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap`}>
                        {r.createdAt}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {earlyAccessModuleLabel(r.moduleKey, t)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{r.eventType}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{r.userEmail ?? "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{r.organizationName ?? "—"}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {r.durationMs ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#7F8C8D]">{t("superAdmin.earlyAccessEmpty")}</p>
          )}
        </div>
      )}

      {tab === "landing" && <LandingModulesEditor />}

      {subModalOrg ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sub-modal-title"
        >
          <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`}>
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h2
                id="sub-modal-title"
                className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]"
              >
                {t("superAdmin.orgSubModalTitle")}
              </h2>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setSubModalOrg(null)}
                disabled={subSaving}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </header>
            <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
              <p className="m-0 text-[13px] text-[#34495E]">
                {subModalOrg.name}{" "}
                <span className="font-mono text-[13px] tabular-nums text-[#7F8C8D]">({subModalOrg.taxId})</span>
              </p>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.orgSubTier")}
                <select
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  value={subTier}
                  onChange={(e) => {
                    const v = e.target.value as typeof subTier;
                    setSubTier(v);
                    if (v === "TIER_3" && subExpires.trim() === "") {
                      setSubExpires(addOneYearFromTodayDateInput());
                    }
                  }}
                >
                  <option value="TIER_1">TIER_1</option>
                  <option value="TIER_2">TIER_2</option>
                  <option value="TIER_3">TIER_3</option>
                </select>
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.orgSubExpires")}
                <input
                  type="date"
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  value={subExpires}
                  onChange={(e) => setSubExpires(e.target.value)}
                />
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[#34495E]">
                <input
                  type="checkbox"
                  className={`mt-0.5 ${MODAL_CHECKBOX_CLASS}`}
                  checked={subBlocked}
                  onChange={(e) => setSubBlocked(e.target.checked)}
                />
                <span>{t("superAdmin.orgSubBlocked")}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[#34495E]">
                <input
                  type="checkbox"
                  className={`mt-0.5 ${MODAL_CHECKBOX_CLASS}`}
                  checked={subTrial}
                  onChange={(e) => setSubTrial(e.target.checked)}
                />
                <span>{t("superAdmin.orgSubTrial")}</span>
              </label>
              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-[#34495E]">{t("superAdmin.orgSubModules")}</div>
                <p className="mb-2 m-0 text-[13px] text-[#7F8C8D]">{t("superAdmin.orgSubModulesHint")}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MODULE_SLUG_PRESETS.map((slug) => (
                    <label key={slug} className="flex cursor-pointer items-center gap-2 font-mono text-[13px] text-[#34495E]">
                      <input
                        type="checkbox"
                        className={MODAL_CHECKBOX_CLASS}
                        checked={Boolean(subPreset[slug])}
                        onChange={() =>
                          setSubPreset((s) => ({
                            ...s,
                            [slug]: !s[slug],
                          }))
                        }
                      />
                      {slug}
                    </label>
                  ))}
                </div>
                <div className="mb-1.5 mt-4 text-[13px] font-semibold text-[#34495E]">
                  {t("superAdmin.orgSubIndustryModules")}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {INDUSTRY_MODULE_SLUG_PRESETS.map((slug) => (
                    <label key={slug} className="flex cursor-pointer items-center gap-2 font-mono text-[13px] text-[#34495E]">
                      <input
                        type="checkbox"
                        className={MODAL_CHECKBOX_CLASS}
                        checked={Boolean(subPreset[slug])}
                        onChange={() =>
                          setSubPreset((s) => ({
                            ...s,
                            [slug]: !s[slug],
                          }))
                        }
                      />
                      {slug}
                    </label>
                  ))}
                </div>
                <label className={`${MODAL_FIELD_LABEL_CLASS} mt-3`}>
                  {t("superAdmin.orgSubModulesExtra")}
                  <input
                    className={`mt-1 block w-full ${MODAL_INPUT_MONO_CLASS}`}
                    value={subExtra}
                    onChange={(e) => setSubExtra(e.target.value)}
                    placeholder="ifrs_mapping, …"
                  />
                </label>
              </div>
            </div>
            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => setSubModalOrg(null)}
                disabled={subSaving}
              >
                {t("superAdmin.orgSubCancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={subSaving}
                onClick={() => void saveSubscription()}
              >
                {t("superAdmin.orgSubSave")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {userOrgsUserId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-3xl`}>
            <header className="flex shrink-0 items-start justify-between gap-4">
              <div className="min-w-0 flex-1 pr-2">
                <h2 className="m-0 text-lg font-semibold leading-snug text-[#34495E]">
                  {t("superAdmin.userOrgsModalTitle")}
                </h2>
                {userOrgsData ? (
                  <p className="mb-0 mt-1 font-mono text-[13px] text-[#7F8C8D]">{userOrgsData.email}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                className={`${MODAL_CLOSE_BUTTON_CLASS} shrink-0`}
                onClick={() => {
                  setUserOrgsUserId(null);
                  setUserOrgsData(null);
                }}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </header>
            <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
            {userOrgsLoading ? (
              <p className="text-sm text-gray-500">{t("common.loading")}</p>
            ) : userOrgsData && userOrgsData.items.length === 0 ? (
              <p className="text-sm text-gray-600">
                {t("superAdmin.userOrgsEmpty")}
              </p>
            ) : userOrgsData ? (
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={DATA_TABLE_CLASS}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>
                        {t("superAdmin.userOrgsColCompany")}
                      </th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.userOrgsColVoen")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.userOrgsColRole")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.userOrgsColTier")}</th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                        {t("superAdmin.userOrgsColExpires")}
                      </th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>
                        {t("superAdmin.userOrgsColModules")}
                      </th>
                      <th className={DATA_TABLE_TH_CENTER_CLASS}>
                        {t("superAdmin.userOrgsColTrial")}
                      </th>
                      <th className={DATA_TABLE_TH_CENTER_CLASS}>
                        {t("superAdmin.userOrgsColBlocked")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {userOrgsData.items.map((row) => (
                      <tr key={row.organizationId} className={DATA_TABLE_TR_CLASS}>
                        <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                          {row.organizationName}
                        </td>
                        <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>{row.taxId}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{roleLabel(row.role, t)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {row.subscription
                            ? row.subscription.tier
                            : "—"}
                        </td>
                        <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>
                          {fmtExpires(row.subscription?.expiresAt)}
                        </td>
                        <td className={`${DATA_TABLE_TD_CLASS} max-w-[180px] break-all text-xs`}>
                          {fmtModules(row.subscription?.activeModules)}
                        </td>
                        <td className={DATA_TABLE_TD_CENTER_CLASS}>
                          {row.subscription?.isTrial
                            ? t("common.yes")
                            : t("common.no")}
                        </td>
                        <td className={DATA_TABLE_TD_CENTER_CLASS}>
                          {row.subscription?.isBlocked
                            ? t("common.yes")
                            : t("common.no")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
