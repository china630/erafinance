"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiBaseUrl, apiFetch } from "../../lib/api-client";
import { LINK_ACCENT_CLASS, PRIMARY_BUTTON_CLASS } from "../../lib/design-system";
import { FORM_INPUT_CLASS } from "../../lib/form-styles";
import type { AuthUser, OrgSummary } from "../../lib/auth-context";
import { useAuth } from "../../lib/auth-context";
import { LanguageSwitcher } from "../language-switcher";
import { PublicLegalFooter } from "../../components/public-legal-footer";
import {
  COUNTERPARTY_LEGAL_FORMS,
  type CounterpartyLegalForm,
  counterpartyLegalFormI18nKey,
} from "../../lib/counterparty-legal-form";

const REFERRAL_STORAGE_KEY = "era.referral";
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { code?: string; exp?: number };
    if (!j.code || typeof j.exp !== "number" || j.exp < Date.now()) {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return j.code;
  } catch {
    return null;
  }
}

export default function RegisterOrgPage() {
  const { t } = useTranslation();
  const { login, token, ready, user } = useAuth();
  const router = useRouter();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [legalForm, setLegalForm] = useState<CounterpartyLegalForm>("LLC");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !token || !user) return;
    if (!user.organizationId) {
      router.replace("/companies");
      return;
    }
    router.replace("/home");
  }, [ready, token, user, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get("ref")?.trim();
    if (fromUrl) {
      window.localStorage.setItem(
        REFERRAL_STORAGE_KEY,
        JSON.stringify({ code: fromUrl, exp: Date.now() + REFERRAL_TTL_MS }),
      );
      setReferralCode(fromUrl);
      return;
    }
    setReferralCode(readStoredReferralCode());
  }, []);

  if (ready && token) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          taxId,
          adminFirstName: adminFirstName.trim(),
          adminLastName: adminLastName.trim(),
          adminEmail,
          adminPassword,
          legalForm,
          ...(referralCode ? { referralCode } : {}),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt || String(res.status));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        user: AuthUser;
        organizations: OrgSummary[];
      };
      const orgs = data.organizations ?? [];
      login(data.accessToken, data.user, orgs);
      if (orgs.length === 0) {
        router.replace("/companies");
      } else {
        router.replace(orgs.length > 1 ? "/companies" : "/");
      }
    } catch {
      setError(t("auth.apiUnreachable", { url: apiBaseUrl() }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-200 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-100 shadow-md p-8">
        <div className="mb-6">
          <LanguageSwitcher />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">{t("auth.registerOrgTitle")}</h1>
        {referralCode ? (
          <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            {t("register.referral.applied", { code: referralCode })}
          </p>
        ) : null}
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          <label className="block text-sm font-medium text-gray-700">
            {t("auth.orgName")}
            <input
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t("auth.taxId")}
            <input
              required
              pattern="[0-9]{10}"
              maxLength={10}
              value={taxId}
              onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t("counterparties.legalFormField")}
            <select
              required
              value={legalForm}
              onChange={(e) => setLegalForm(e.target.value as CounterpartyLegalForm)}
              className={FORM_INPUT_CLASS}
            >
              {COUNTERPARTY_LEGAL_FORMS.map((item) => (
                <option key={item} value={item}>
                  {t(counterpartyLegalFormI18nKey(item))}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t("auth.firstName")}
            <input
              required
              autoComplete="given-name"
              value={adminFirstName}
              onChange={(e) => setAdminFirstName(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t("auth.lastName")}
            <input
              required
              autoComplete="family-name"
              value={adminLastName}
              onChange={(e) => setAdminLastName(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t("auth.adminEmail")}
            <input
              type="email"
              required
              autoComplete="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t("auth.adminPassword")}
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
            {t("auth.submitRegister")}
          </button>
        </form>
        <p className="mt-6 text-sm">
          <Link href="/login" className={LINK_ACCENT_CLASS}>
            {t("auth.haveAccount")}
          </Link>
        </p>
        <p className="mt-3 text-sm text-gray-600">
          <Link href="/register" className={LINK_ACCENT_CLASS}>
            {t("auth.registerUserLink")}
          </Link>
        </p>
        <PublicLegalFooter />
      </div>
    </main>
  );
}
