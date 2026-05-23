"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api-client";
import { uiLangRuAz } from "../lib/i18n/ui-lang";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../lib/design-system";
import { Button } from "./ui/button";

type ModalReason = "quota" | "read_only" | "credit_lock" | "usage_cap";
type CustomUpgradeDetail = {
  title?: string;
  body?: string;
};
type UpgradePreviewResponse = {
  amountToPay: string;
  daysRemaining: number;
  currentTier: string;
  newTier: string;
};

/**
 * Shown on 402 QUOTA_EXCEEDED: upgrade / subscription (PRD §7.12).
 */
export function UpgradePlanModalHost() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ModalReason>("quota");
  const [quotaDetail, setQuotaDetail] = useState<unknown>(null);
  const [custom, setCustom] = useState<CustomUpgradeDetail | null>(null);
  const [preview, setPreview] = useState<UpgradePreviewResponse | null>(null);

  const onQuota = useCallback((ev: Event) => {
    const ce = ev as CustomEvent<unknown>;
    const detail = ce.detail ?? null;
    setQuotaDetail(detail);
    const code =
      detail &&
      typeof detail === "object" &&
      "code" in detail &&
      typeof (detail as { code?: string }).code === "string"
        ? (detail as { code: string }).code
        : undefined;
    if (code === "CREDIT_HARD_LOCK") {
      setReason("credit_lock");
    } else if (code === "USAGE_CAP_EXCEEDED") {
      setReason("usage_cap");
    } else {
      setReason("quota");
    }
    setOpen(true);
  }, []);

  const onReadOnly = useCallback(() => {
    setCustom(null);
    setReason("read_only");
    setOpen(true);
  }, []);

  const onCustomUpgrade = useCallback((ev: Event) => {
    const ce = ev as CustomEvent<CustomUpgradeDetail>;
    setCustom(ce.detail ?? null);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener("erafinance:subscription-read-only", onReadOnly);
    window.addEventListener("erafinance:quota-upgrade", onQuota);
    window.addEventListener("erafinance:upgrade-modal-custom", onCustomUpgrade);
    return () => {
      window.removeEventListener("erafinance:subscription-read-only", onReadOnly);
      window.removeEventListener("erafinance:quota-upgrade", onQuota);
      window.removeEventListener("erafinance:upgrade-modal-custom", onCustomUpgrade);
    };
  }, [onCustomUpgrade, onQuota, onReadOnly]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const res = await apiFetch("/api/billing/upgrade-preview?newTier=TIER_3");
      if (cancelled || !res.ok) {
        if (!cancelled) setPreview(null);
        return;
      }
      const data = (await res.json()) as UpgradePreviewResponse;
      if (!cancelled) {
        setPreview(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const lang = uiLangRuAz(i18n.language);
  const quotaMsg =
    quotaDetail &&
    typeof quotaDetail === "object" &&
    quotaDetail !== null &&
    "message" in quotaDetail &&
    typeof (quotaDetail as { message?: { az?: string; ru?: string } }).message === "object"
      ? (quotaDetail as { message: { az?: string; ru?: string } }).message[lang]
      : null;

  const body =
    reason === "credit_lock"
      ? quotaMsg || t("upgradeModal.creditHardLockBody")
      : reason === "usage_cap"
        ? quotaMsg || t("upgradeModal.usageCapBody")
        : reason === "quota"
          ? quotaMsg || t("upgradeModal.quotaBody")
          : t("upgradeModal.body");
  const title =
    custom?.title?.trim() ||
    (reason === "credit_lock"
      ? t("upgradeModal.creditHardLockTitle")
      : reason === "usage_cap"
        ? t("upgradeModal.usageCapTitle")
        : reason === "quota"
          ? t("upgradeModal.quotaTitle")
          : t("upgradeModal.title"));
  const text = custom?.body?.trim() || body;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-plan-modal-title"
    >
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}>
        <header className="flex shrink-0 items-start justify-between gap-3">
          <h2
            id="upgrade-plan-modal-title"
            className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]"
          >
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className={MODAL_CLOSE_BUTTON_CLASS}
            onClick={() => setOpen(false)}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </header>
        <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto">
          <p className="mb-0 text-[13px] leading-relaxed text-[#7F8C8D]">{text}</p>
          {preview ? (
            <div className="rounded-lg border border-[#D5DADF] bg-[#F4F5F7] px-3 py-2.5">
              <p className="m-0 text-[13px] font-semibold text-[#34495E]">{t("upgradeModal.previewTitle")}</p>
              <p className="mb-0 mt-1 text-[13px] leading-snug text-[#34495E]">
                {t("upgradeModal.previewBody", {
                  amount: preview.amountToPay,
                  daysRemaining: preview.daysRemaining,
                  currentTier: preview.currentTier,
                })}
              </p>
            </div>
          ) : null}
        </div>
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button
            type="button"
            variant="outline"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={() => setOpen(false)}
          >
            {t("upgradeModal.close")}
          </Button>
          <Link
            href="/settings/subscription"
            onClick={() => setOpen(false)}
            className={`${PRIMARY_BUTTON_CLASS} ${MODAL_FOOTER_BUTTON_CLASS}`}
          >
            {t("upgradeModal.openSubscription")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use {@link UpgradePlanModalHost} */
export const UpgradeRequiredModalHost = UpgradePlanModalHost;
