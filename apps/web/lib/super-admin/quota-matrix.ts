import type { TierKey } from "./billing-types";

export type TierQuotasFields = {
  maxEmployees: number | null;
  maxInvoicesPerMonth: number | null;
  maxStorageGb: number | null;
  maxWhatsappAlertsPerMonth: number | null;
  maxOcrPagesPerMonth: number | null;
  maxWorkspaces: number | null;
};

export type QuotaMatrixFieldKey = keyof TierQuotasFields;

export const QUOTA_MATRIX_TIERS: TierKey[] = [
  "TIER_0",
  "TIER_1",
  "TIER_2",
  "TIER_3",
];

export const QUOTA_MATRIX_ROWS: readonly {
  field: QuotaMatrixFieldKey;
  labelKey: string;
}[] = [
  { field: "maxEmployees", labelKey: "superAdmin.tierQuotaFieldEmployees" },
  {
    field: "maxInvoicesPerMonth",
    labelKey: "superAdmin.tierQuotaFieldInvoicesMonthShort",
  },
  { field: "maxStorageGb", labelKey: "superAdmin.tierQuotaFieldStorageGb" },
  {
    field: "maxWhatsappAlertsPerMonth",
    labelKey: "superAdmin.tierQuotaFieldWhatsapp",
  },
  { field: "maxOcrPagesPerMonth", labelKey: "superAdmin.tierQuotaFieldOcrPages" },
  { field: "maxWorkspaces", labelKey: "superAdmin.tierQuotaFieldWorkspaces" },
];

export function emptyQuotaMatrixDraft(): Record<
  TierKey,
  Record<QuotaMatrixFieldKey, string>
> {
  const row = () =>
    ({
      maxEmployees: "",
      maxInvoicesPerMonth: "",
      maxStorageGb: "",
      maxWhatsappAlertsPerMonth: "",
      maxOcrPagesPerMonth: "",
      maxWorkspaces: "",
    }) satisfies Record<QuotaMatrixFieldKey, string>;

  return {
    TIER_0: row(),
    TIER_1: row(),
    TIER_2: row(),
    TIER_3: row(),
  };
}

export function quotasFromBilling(
  raw: Record<string, Record<string, unknown>> | undefined,
): Record<TierKey, Record<QuotaMatrixFieldKey, string>> {
  const draft = emptyQuotaMatrixDraft();
  for (const tier of QUOTA_MATRIX_TIERS) {
    const q = raw?.[tier] ?? {};
    for (const { field } of QUOTA_MATRIX_ROWS) {
      const v = q[field];
      draft[tier][field] =
        v === null || v === undefined ? "" : String(v);
    }
  }
  return draft;
}

export function parseQuotaCell(
  s: string,
): number | null | undefined {
  const x = s.trim();
  if (x === "") return null;
  const v = Number.parseInt(x.replace(/\s/g, ""), 10);
  if (!Number.isFinite(v) || v < 0) return undefined;
  return v;
}

export function buildQuotasMatrixPayload(
  draft: Record<TierKey, Record<QuotaMatrixFieldKey, string>>,
): { quotas: Record<TierKey, TierQuotasFields> } | null {
  const quotas = {} as Record<TierKey, TierQuotasFields>;
  for (const tier of QUOTA_MATRIX_TIERS) {
    const row = {} as TierQuotasFields;
    for (const { field } of QUOTA_MATRIX_ROWS) {
      const parsed = parseQuotaCell(draft[tier][field]);
      if (parsed === undefined) return null;
      row[field] = parsed;
    }
    quotas[tier] = row;
  }
  return { quotas };
}
