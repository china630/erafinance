"use client";

import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
} from "../lib/design-system";
import { Button } from "./ui/button";

type Mode = "enable" | "disable";

export function PaymentConfirmationModal(props: {
  open: boolean;
  mode: Mode;
  monthlyAzn: string;
  proRataAzn: string;
  onClose: () => void;
  onConfirmPay: () => void;
  confirmDisabled?: boolean;
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-confirm-title"
    >
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}>
        <header className="flex shrink-0 items-start justify-between gap-3">
          <h2
            id="payment-confirm-title"
            className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]"
          >
            {props.mode === "enable"
              ? t("billing.subscription.confirmEnableTitle")
              : t("billing.subscription.confirmDisableTitle")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className={MODAL_CLOSE_BUTTON_CLASS}
            onClick={props.onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </header>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          {props.mode === "enable" ? (
            <p className="m-0 text-[13px] leading-relaxed text-[#34495E]">
              {t("billing.subscription.proRataExplain", {
                monthly: props.monthlyAzn,
                prorata: props.proRataAzn,
              })}
            </p>
          ) : (
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-[13px] text-amber-950">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
              <p className="m-0">{t("billing.subscription.disableWarning")}</p>
            </div>
          )}
          {props.extra}
        </div>
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={props.onClose}>
            {t("common.cancel")}
          </Button>
          {props.mode === "enable" ? (
            <Button
              type="button"
              variant="primary"
              className={MODAL_FOOTER_BUTTON_CLASS}
              disabled={props.confirmDisabled}
              onClick={props.onConfirmPay}
            >
              {t("billing.subscription.payButtonAz")}
            </Button>
          ) : (
            <button
              type="button"
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-600 ${MODAL_FOOTER_BUTTON_CLASS}`}
              onClick={props.onConfirmPay}
            >
              {t("billing.subscription.confirmDisableAz")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
