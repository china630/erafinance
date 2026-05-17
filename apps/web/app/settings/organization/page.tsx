"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  LINK_ACCENT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { DatePicker } from "../../../components/ui/date-picker";

type OrgSettings = {
  id: string;
  name: string;
  taxId: string;
  legalAddress: string | null;
  phone: string | null;
  directorName: string | null;
  logoUrl: string | null;
  valuationMethod: "AVCO" | "FIFO";
  settings?: {
    ledger?: {
      lockedPeriodUntil?: string | null;
    };
  };
};

export default function OrganizationSettingsPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();
  const { user } = useAuth();
  const canEditGeneral = user?.role === "OWNER" || user?.role === "ADMIN";
  const canEditPeriodLock = user?.role === "OWNER" || user?.role === "ACCOUNTANT";
  const canOpenPage = canEditGeneral || canEditPeriodLock;

  const [tab, setTab] = useState<"general" | "policy">("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [valuationMethod, setValuationMethod] = useState<"AVCO" | "FIFO">("AVCO");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [taxId, setTaxId] = useState("");
  const [lockedPeriodUntil, setLockedPeriodUntil] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/organization/settings");
    if (!res.ok) {
      setErr(String(res.status));
      setLoading(false);
      return;
    }
    const o = (await res.json()) as OrgSettings;
    setName(o.name);
    setTaxId(o.taxId);
    setLegalAddress(o.legalAddress ?? "");
    setPhone(o.phone ?? "");
    setDirectorName(o.directorName ?? "");
    setValuationMethod(o.valuationMethod === "FIFO" ? "FIFO" : "AVCO");
    setLogoUrl(o.logoUrl ?? null);
    setLockedPeriodUntil(o.settings?.ledger?.lockedPeriodUntil ?? "");
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !canEditGeneral) return;
    setSaving(true);
    setErr(null);
    const res = await apiFetch("/api/organization/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        legalAddress: legalAddress.trim() || null,
        phone: phone.trim() || null,
        directorName: directorName.trim() || null,
        logoUrl: logoUrl || null,
        valuationMethod,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setErr(await res.text());
      toast.error(t("orgSettings.saveErr"));
      return;
    }
    toast.success(t("orgSettings.saveOk"));
    await load();
  }

  async function onLogoChange(file: File | null) {
    if (!file || !token || !canEditGeneral) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/organization/settings/logo", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      toast.error(t("orgSettings.logoErr"));
      return;
    }
    const j = (await res.json()) as { logoUrl: string };
    setLogoUrl(j.logoUrl);
    toast.success(t("orgSettings.logoOk"));
  }

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
        tab === id
          ? "border-[#2980B9] bg-white text-[#34495E] shadow-sm"
          : "border-transparent text-[#7F8C8D] hover:border-[#D5DADF]"
      }`}
    >
      {label}
    </button>
  );

  const title = useMemo(() => t("orgSettings.title"), [t]);

  async function onSavePeriodLock() {
    if (!token || !canEditPeriodLock) return;
    const lockDate = lockedPeriodUntil.trim();
    if (lockDate) {
      const month = lockDate.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) {
        const checkRes = await apiFetch(
          `/api/accounting/period-close/checklist?month=${encodeURIComponent(month)}`,
        );
        if (!checkRes.ok) {
          toast.error(t("orgSettings.periodChecklistErr", { defaultValue: "Не удалось выполнить checklist закрытия периода" }));
          return;
        }
        const checklist = (await checkRes.json()) as {
          allPassed: boolean;
          checks: {
            noDraftInvoices: { ok: boolean; draftCount: number };
            noNegativeStock: { ok: boolean; affectedCount: number };
            noNegativeCash: { ok: boolean; affectedAccounts: string[] };
            depreciationAccruedIfNeeded: { ok: boolean };
          };
        };
        if (!checklist.allPassed) {
          const issues: string[] = [];
          if (!checklist.checks.noDraftInvoices.ok) {
            issues.push(
              t("orgSettings.periodChecklistDraftInvoices", {
                defaultValue: "Есть черновики инвойсов",
              }) + `: ${checklist.checks.noDraftInvoices.draftCount}`,
            );
          }
          if (!checklist.checks.noNegativeStock.ok) {
            issues.push(
              t("orgSettings.periodChecklistNegativeStock", {
                defaultValue: "Есть отрицательные складские остатки",
              }) + `: ${checklist.checks.noNegativeStock.affectedCount}`,
            );
          }
          if (!checklist.checks.noNegativeCash.ok) {
            issues.push(
              t("orgSettings.periodChecklistNegativeCash", {
                defaultValue: "Есть отрицательные денежные остатки",
              }) + `: ${checklist.checks.noNegativeCash.affectedAccounts.join(", ")}`,
            );
          }
          if (!checklist.checks.depreciationAccruedIfNeeded.ok) {
            issues.push(
              t("orgSettings.periodChecklistDepreciation", {
                defaultValue: "Не начислена амортизация при наличии активных ОС",
              }),
            );
          }
          toast.error(
            t("orgSettings.periodChecklistFailed", {
              defaultValue: "Нельзя закрыть период, checklist не пройден",
            }),
            { description: issues.join(" | ") },
          );
          return;
        }
      }
    }
    setSaving(true);
    const res = await apiFetch("/api/organization/settings/period-lock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lockedPeriodUntil: lockedPeriodUntil.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(t("orgSettings.saveErr"));
      return;
    }
    toast.success(t("orgSettings.periodLockSaved"));
    await load();
  }

  if (!ready || !token) {
    return <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>;
  }

  if (!canOpenPage) {
    return (
      <div className="max-w-3xl space-y-4">
        <PageHeader title={title} subtitle={t("orgSettings.noAccess")} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={title} subtitle={t("orgSettings.subtitle")} />

      <div className="flex flex-wrap gap-2 border-b border-[#D5DADF] pb-2">
        {tabBtn("general", t("orgSettings.tabGeneral"))}
        {tabBtn("policy", t("orgSettings.tabPolicy"))}
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}
      {loading && <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>}

      {!loading && (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
          {tab === "general" && (
            <div className="space-y-6">
              <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
                <h3 className="m-0 text-[13px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                  {t("orgSettings.cardLegalTitle")}
                </h3>
                <label className="block text-[#34495E] text-sm">
                  {t("orgSettings.name")}
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`block mt-1 w-full max-w-xl ${INPUT_BORDERED_CLASS}`}
                    required
                    disabled={!canEditGeneral}
                  />
                </label>
                <label className="block text-[#34495E] text-sm">
                  {t("orgSettings.legalAddress")}
                  <textarea
                    value={legalAddress}
                    onChange={(e) => setLegalAddress(e.target.value)}
                    rows={3}
                    className={`block mt-1 w-full max-w-2xl ${INPUT_BORDERED_CLASS}`}
                    disabled={!canEditGeneral}
                  />
                </label>
                <label className="block text-[#34495E] text-sm">
                  {t("orgSettings.taxId")}
                  <input
                    value={taxId}
                    readOnly
                    className={`block mt-1 w-full max-w-xs ${INPUT_BORDERED_CLASS} bg-slate-50`}
                  />
                </label>
              </section>

              <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
                <h3 className="m-0 text-[13px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                  {t("orgSettings.cardCompanyTitle")}
                </h3>
                <label className="block text-[#34495E] text-sm">
                  {t("orgSettings.director")}
                  <input
                    value={directorName}
                    onChange={(e) => setDirectorName(e.target.value)}
                    className={`block mt-1 w-full max-w-xl ${INPUT_BORDERED_CLASS}`}
                    disabled={!canEditGeneral}
                  />
                </label>
                <label className="block text-[#34495E] text-sm">
                  {t("orgSettings.phone")}
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`block mt-1 w-full max-w-md ${INPUT_BORDERED_CLASS}`}
                    disabled={!canEditGeneral}
                  />
                </label>
              </section>

              <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
                <h3 className="m-0 text-[13px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                  {t("orgSettings.cardIdentityTitle")}
                </h3>
                <div>
                  <span className="text-xs font-bold text-[#7F8C8D] uppercase tracking-wide block mb-1">
                    {t("orgSettings.logo")}
                  </span>
                  {logoUrl ? (
                    <img
                      src={
                        logoUrl.startsWith("http")
                          ? logoUrl
                          : `${typeof window !== "undefined" ? window.location.origin : ""}${logoUrl}`
                      }
                      alt=""
                      className="h-16 object-contain mb-2 border border-[#D5DADF] rounded p-1 bg-white"
                    />
                  ) : null}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={saving || !canEditGeneral}
                    onChange={(e) => void onLogoChange(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                </div>
              </section>
            </div>
          )}

          {tab === "policy" && (
            <section className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
              <p className="text-sm font-semibold text-[#34495E]">{t("orgSettings.valuationTitle")}</p>
              <label className="flex items-start gap-2 text-sm text-[#34495E]">
                <input
                  type="radio"
                  name="vm"
                  checked={valuationMethod === "AVCO"}
                  onChange={() => setValuationMethod("AVCO")}
                  disabled={!canEditGeneral}
                />
                <span>
                  <strong className="text-[#34495E]">AVCO</strong> — {t("orgSettings.valuationAvco")}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-[#34495E]">
                <input
                  type="radio"
                  name="vm"
                  checked={valuationMethod === "FIFO"}
                  onChange={() => setValuationMethod("FIFO")}
                  disabled={!canEditGeneral}
                />
                <span>
                  <strong className="text-[#34495E]">FIFO</strong> — {t("orgSettings.valuationFifo")}
                </span>
              </label>
              <div className="rounded-2xl border border-[#D5DADF] bg-[#EBEDF0]/40 p-4 space-y-2">
                <p className="text-sm font-semibold text-[#34495E]">
                  {t("orgSettings.bankAccountsCardTitle")}
                </p>
                <p className="text-xs text-[#7F8C8D] leading-relaxed">
                  {t("orgSettings.bankAccountsCardHint")}
                </p>
                <Link href="/settings/bank-accounts" className={`${LINK_ACCENT_CLASS} text-[13px] font-semibold`}>
                  {t("orgSettings.bankAccountsCardLink")}
                </Link>
              </div>
              <div className="rounded-2xl border border-[#D5DADF] bg-[#EBEDF0]/40 p-4 space-y-2">
                <p className="text-sm font-semibold text-[#34495E]">
                  {t("orgSettings.depreciationPolicyTitle")}
                </p>
                <p className="text-xs text-[#7F8C8D] leading-relaxed">
                  {t("orgSettings.depreciationPolicyBody")}
                </p>
                <Link href="/fixed-assets" className={`${LINK_ACCENT_CLASS} text-[13px] font-semibold`}>
                  {t("orgSettings.depreciationPolicyLink")}
                </Link>
              </div>
              <div className="border-t border-[#D5DADF] pt-3 mt-3 space-y-2">
                <p className="text-sm font-semibold text-[#34495E]">
                  {t("orgSettings.periodLockTitle")}
                </p>
                <p className="text-xs text-[#7F8C8D]">{t("orgSettings.periodLockHint")}</p>
                <label className="block text-[#34495E] text-sm">
                  {t("orgSettings.periodLockUntil")}
                  <DatePicker
                    respectPeriodLock={false}
                    triggerClassName={`block mt-1 w-full max-w-xs ${INPUT_BORDERED_CLASS}`}
                    value={lockedPeriodUntil}
                    onChange={setLockedPeriodUntil}
                    disabled={!canEditPeriodLock || saving}
                  />
                </label>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void onSavePeriodLock()}
                  disabled={!canEditPeriodLock || saving}
                >
                  {saving ? t("common.loading") : t("orgSettings.periodLockSave")}
                </button>
              </div>
            </section>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !canEditGeneral}
              className={PRIMARY_BUTTON_CLASS}
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
              {t("common.refresh")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
