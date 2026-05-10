"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import {
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
} from "../../../lib/form-styles";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";

type ProfilePayload = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  locale: "AZ" | "RU";
  avatarUrl: string | null;
};

export default function ProfileSettingsPage() {
  const { t, i18n } = useTranslation();
  const { ready, token } = useRequireAuth();
  const { refreshSession } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locale, setLocale] = useState<"AZ" | "RU">("AZ");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/users/me");
    if (!res.ok) {
      toast.error(t("profile.loadErr"));
      setLoading(false);
      return;
    }
    const p = (await res.json()) as ProfilePayload;
    setFirstName(p.firstName ?? "");
    setLastName(p.lastName ?? "");
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
    setLocale(p.locale ?? "AZ");
    setLoading(false);
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() === "" ? "" : phone.trim(),
        locale,
      };
      if (currentPassword && newPassword) {
        body.passwordChange = {
          currentPassword,
          newPassword,
        };
      }
      const res = await apiFetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      if (!res.ok) {
        let j: {
          statusCode?: number;
          message?: unknown;
          code?: string;
        } = {};
        try {
          j = raw ? (JSON.parse(raw) as typeof j) : {};
        } catch {
          j = {};
        }
        const nested =
          typeof j.message === "object" && j.message != null
            ? (j.message as { code?: string; message?: string })
            : null;
        let code: string | undefined = nested?.code ?? undefined;
        if (!code && typeof j.code === "string") code = j.code;
        if (
          code === "INVALID_CURRENT_PASSWORD" ||
          nested?.code === "INVALID_CURRENT_PASSWORD"
        ) {
          toast.error(t("profile.invalidPassword"));
        } else if (res.status === 409) {
          toast.error(t("profile.emailTaken"));
        } else {
          const msg =
            typeof j.message === "string"
              ? j.message
              : nested?.message ?? String(res.status);
          toast.error(msg);
        }
        setSaving(false);
        return;
      }
      toast.success(t("profile.saved"));
      setCurrentPassword("");
      setNewPassword("");
      await refreshSession();
      await i18n.changeLanguage(locale === "AZ" ? "az" : "ru");
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="px-4 py-6 text-sm text-slate-500">
        {t("profile.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
      />

      <form onSubmit={onSubmit} className={`mt-6 space-y-6 ${CARD_CONTAINER_CLASS}`}>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-first">
            {t("profile.firstName")}
          </label>
          <input
            id="profile-first"
            className={FORM_INPUT_CLASS}
            value={firstName}
            onChange={(ev) => setFirstName(ev.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-last">
            {t("profile.lastName")}
          </label>
          <input
            id="profile-last"
            className={FORM_INPUT_CLASS}
            value={lastName}
            onChange={(ev) => setLastName(ev.target.value)}
            autoComplete="family-name"
          />
        </div>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-email">
            {t("profile.email")}
          </label>
          <input
            id="profile-email"
            type="email"
            className={FORM_INPUT_CLASS}
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-phone">
            {t("profile.phone")}
          </label>
          <input
            id="profile-phone"
            className={FORM_INPUT_CLASS}
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            placeholder="+994501234567"
            autoComplete="tel"
          />
        </div>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-locale">
            {t("profile.locale")}
          </label>
          <select
            id="profile-locale"
            className={FORM_INPUT_CLASS}
            value={locale}
            onChange={(ev) => setLocale(ev.target.value as "AZ" | "RU")}
          >
            <option value="AZ">{t("profile.localeAz")}</option>
            <option value="RU">{t("profile.localeRu")}</option>
          </select>
        </div>

        <div className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-4">
          <button
            type="button"
            className="mb-3 text-sm font-semibold text-[#2980B9]"
            onClick={() => setShowPassword((v) => !v)}
          >
            {t("profile.passwordSection")}
          </button>
          {showPassword ? (
            <div className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS} htmlFor="profile-cur-pw">
                  {t("profile.currentPassword")}
                </label>
                <input
                  id="profile-cur-pw"
                  type="password"
                  className={FORM_INPUT_CLASS}
                  value={currentPassword}
                  onChange={(ev) => setCurrentPassword(ev.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className={FORM_LABEL_CLASS} htmlFor="profile-new-pw">
                  {t("profile.newPassword")}
                </label>
                <input
                  id="profile-new-pw"
                  type="password"
                  className={FORM_INPUT_CLASS}
                  value={newPassword}
                  onChange={(ev) => setNewPassword(ev.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
                <p className="mt-1 text-xs text-slate-500">{t("profile.passwordHint")}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className={`${PRIMARY_BUTTON_CLASS} rounded-lg px-5 py-2`}
          >
            {saving ? t("profile.saving") : t("profile.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
