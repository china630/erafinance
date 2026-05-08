"use client";

import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useSubscription } from "../lib/subscription-context";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../lib/design-system";

export function RpaUpsellModal(props: {
  open: boolean;
  onClose: () => void;
  moduleKey: "taxPro" | "hrFull" | "tradePro";
}) {
  const { t } = useTranslation();
  const { effectiveSnapshot } = useSubscription();
  const hasAccess = useMemo(() => {
    if (props.moduleKey === "taxPro") return Boolean(effectiveSnapshot?.modules.taxPro);
    if (props.moduleKey === "tradePro") return Boolean(effectiveSnapshot?.modules.tradePro);
    return Boolean(effectiveSnapshot?.modules.hrFull);
  }, [
    effectiveSnapshot?.modules.hrFull,
    effectiveSnapshot?.modules.taxPro,
    effectiveSnapshot?.modules.tradePro,
    props.moduleKey,
  ]);

  if (!props.open || hasAccess) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#D5DADF] bg-white p-5 shadow-xl space-y-3">
        <h3 className="text-lg font-semibold text-[#34495E]">{t("bulk.upsell.title")}</h3>
        <p className="text-sm text-[#4B5563]">{t("bulk.upsell.body")}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={props.onClose}>
            {t("common.cancel")}
          </button>
          <a href="/settings/subscription" className={PRIMARY_BUTTON_CLASS} onClick={props.onClose}>
            {t("bulk.upsell.cta")}
          </a>
        </div>
      </div>
    </div>
  );
}
