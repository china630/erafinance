"use client";

import { useTranslation } from "react-i18next";
import type { TierKey } from "../../lib/super-admin/billing-types";
import {
  QUOTA_MATRIX_ROWS,
  QUOTA_MATRIX_TIERS,
  type QuotaMatrixFieldKey,
} from "../../lib/super-admin/quota-matrix";

const GRID =
  "grid grid-cols-[minmax(10rem,1.2fr)_repeat(4,minmax(4.5rem,1fr))] gap-1 items-center";

export function BillingQuotasMatrix({
  draft,
  tierPrices,
  onCellChange,
  onTierPriceChange,
  disabled,
}: {
  draft: Record<TierKey, Record<QuotaMatrixFieldKey, string>>;
  tierPrices: Record<TierKey, string>;
  onCellChange: (
    tier: TierKey,
    field: QuotaMatrixFieldKey,
    value: string,
  ) => void;
  onTierPriceChange: (tier: TierKey, value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#D5DADF] bg-white">
      <div className={`min-w-[44rem] p-3 ${GRID}`}>
        <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7F8C8D]">
          {t("superAdmin.billingMatrixMetricColumn")}
        </div>
        {QUOTA_MATRIX_TIERS.map((tier) => (
          <div
            key={tier}
            className="px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#2980B9]"
          >
            {tier}
          </div>
        ))}

        <div className="col-span-1 border-t border-[#D5DADF]/80 px-2 py-2 text-[12px] font-semibold text-[#34495E]">
          {t("superAdmin.billingTierLegacyPriceShort")}
        </div>
        {QUOTA_MATRIX_TIERS.map((tier) => (
          <div key={`price-${tier}`} className="border-t border-[#D5DADF]/80 px-1 py-1">
            <input
              className="box-border h-8 w-full rounded-lg border border-[#D5DADF] px-2 text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
              inputMode="decimal"
              disabled={disabled}
              value={tierPrices[tier]}
              onChange={(e) => onTierPriceChange(tier, e.target.value)}
              aria-label={`${tier} ${t("superAdmin.billingTierLegacyPriceShort")}`}
            />
          </div>
        ))}

        {QUOTA_MATRIX_ROWS.map(({ field, labelKey }) => (
          <div key={field} className="contents">
            <div className="border-t border-[#D5DADF]/60 px-2 py-1.5 text-[12px] font-medium text-[#34495E]">
              {t(labelKey)}
            </div>
            {QUOTA_MATRIX_TIERS.map((tier) => (
              <div key={`${tier}-${field}`} className="border-t border-[#D5DADF]/60 px-1 py-1">
                <input
                  className="box-border h-8 w-full rounded-lg border border-[#D5DADF] px-2 text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#2980B9]"
                  inputMode="numeric"
                  placeholder="∞"
                  disabled={disabled}
                  value={draft[tier][field]}
                  onChange={(e) => onCellChange(tier, field, e.target.value)}
                  aria-label={`${tier} ${t(labelKey)}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
