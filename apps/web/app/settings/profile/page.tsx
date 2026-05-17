"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "../../../lib/form-styles";
import { normalizeAzPhoneInput, isValidAzPhoneE164 } from "../../../lib/format-phone-az";
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
  emailVerifiedAt: string | null;
};

export default function ProfileSettingsPage() {
  const { t, i18n } = useTranslation();
  const { ready, token } = useRequireAuth();
  const { refreshSession } = useAuth();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerifiedAt, setEmailVerifiedAt] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [locale, setLocale] = useState<"AZ" | "RU">("AZ");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
    setEmailVerifiedAt(p.emailVerifiedAt ?? null);
    setPhone(p.phone ?? "");
    setLocale(p.locale ?? "AZ");
    setLoading(false);
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function parseErrorResponse(res: Response, raw: string) {
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
    return { j, nested, code };
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const emailLocked = emailVerifiedAt != null;
    setSavingProfile(true);
    try {
      const body: Record<string, unknown> = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() === "" ? "" : normalizeAzPhoneInput(phone),
        locale,
      };
      if (!emailLocked) {
        body.email = email.trim() || undefined;
      }
      const res = await apiFetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      if (!res.ok) {
        const { code } = await parseErrorResponse(res, raw);
        if (code === "EMAIL_VERIFIED_LOCKED") {
          toast.error(t("profile.emailLocked"));
        } else if (res.status === 409) {
          toast.error(t("profile.emailTaken"));
        } else {
          toast.error(raw || String(res.status));
        }
        return;
      }
      toast.success(t("profile.saved"));
      await refreshSession();
      await i18n.changeLanguage(locale === "AZ" ? "az" : "ru");
      await load();
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!currentPassword || !newPassword) {
      toast.error(t("profile.passwordFieldsRequired"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("profile.passwordHint"));
      return;
    }
    setSavingPassword(true);
    try {
      const res = await apiFetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passwordChange: {
            currentPassword,
            newPassword,
          },
        }),
      });
      const raw = await res.text();
      if (!res.ok) {
        const { code } = await parseErrorResponse(res, raw);
        if (code === "INVALID_CURRENT_PASSWORD") {
          toast.error(t("profile.invalidPassword"));
        } else {
          toast.error(raw || String(res.status));
        }
        return;
      }
      toast.success(t("profile.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshSession();
      await load();
    } finally {
      setSavingPassword(false);
    }
  }

  if (!ready || loading) {
    return <div className="text-sm text-[#7F8C8D]">{t("profile.loading")}</div>;
  }

  const emailLocked = emailVerifiedAt != null;
  const localeBtn = (value: "AZ" | "RU") => (
    <button
      key={value}
      type="button"
      onClick={() => setLocale(value)}
      className={`rounded-lg border px-4 py-2 text-[13px] font-medium transition ${
        locale === value
          ? "border-[#2980B9] bg-[#2980B9]/10 text-[#34495E]"
          : "border-[#D5DADF] bg-white text-[#7F8C8D] hover:border-[#2980B9]/40"
      }`}
    >
      {value === "AZ" ? t("profile.localeAz") : t("profile.localeRu")}
    </button>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

      <form
        onSubmit={(e) => void onSaveProfile(e)}
        className={`space-y-5 p-6 ${CARD_CONTAINER_CLASS}`}
      >
        <h2 className="m-0 text-[15px] font-semibold text-[#34495E]">
          {t("profile.cardPersonalTitle")}
        </h2>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-first">
            {t("profile.firstName")}
          </label>
          <input
            id="profile-first"
            className={`max-w-xl ${FORM_INPUT_CLASS}`}
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
            className={`max-w-xl ${FORM_INPUT_CLASS}`}
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
            className={`max-w-xl ${FORM_INPUT_CLASS} ${emailLocked ? "bg-[#F4F5F7] text-[#7F8C8D]" : ""}`}
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            autoComplete="email"
            disabled={emailLocked}
          />
          {emailLocked ? (
            <p className="mt-1.5 text-[12px] leading-snug text-[#7F8C8D]">
              {t("profile.emailVerifiedHint")}
            </p>
          ) : null}
        </div>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-phone">
            {t("profile.phone")}
          </label>
          <input
            id="profile-phone"
            className={`max-w-md ${FORM_INPUT_CLASS}`}
            value={phone}
            onChange={(ev) => setPhone(normalizeAzPhoneInput(ev.target.value))}
            placeholder="+994501234567"
            autoComplete="tel"
          />
        </div>
        <div>
          <span className={FORM_LABEL_CLASS}>{t("profile.locale")}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {localeBtn("AZ")}
            {localeBtn("RU")}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={savingProfile} className={PRIMARY_BUTTON_CLASS}>
            {savingProfile ? t("profile.saving") : t("profile.save")}
          </button>
        </div>
      </form>

      <form
        onSubmit={(e) => void onChangePassword(e)}
        className={`space-y-5 p-6 ${CARD_CONTAINER_CLASS}`}
      >
        <h2 className="m-0 text-[15px] font-semibold text-[#34495E]">
          {t("profile.cardPasswordTitle")}
        </h2>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-cur-pw">
            {t("profile.currentPassword")}
          </label>
          <input
            id="profile-cur-pw"
            type="password"
            className={`max-w-md ${FORM_INPUT_CLASS}`}
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
            className={`max-w-md ${FORM_INPUT_CLASS}`}
            value={newPassword}
            onChange={(ev) => setNewPassword(ev.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
          <p className="mt-1 text-[12px] text-[#7F8C8D]">{t("profile.passwordHint")}</p>
        </div>
        <div>
          <label className={FORM_LABEL_CLASS} htmlFor="profile-confirm-pw">
            {t("profile.confirmPassword")}
          </label>
          <input
            id="profile-confirm-pw"
            type="password"
            className={`max-w-md ${FORM_INPUT_CLASS}`}
            value={confirmPassword}
            onChange={(ev) => setConfirmPassword(ev.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingPassword}
            className={SECONDARY_BUTTON_CLASS}
          >
            {savingPassword ? t("profile.saving") : t("profile.changePassword")}
          </button>
        </div>
      </form>
    </div>
  );
}
