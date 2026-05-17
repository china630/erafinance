/** Product rule: VAT (ƏDV) payer registration turnover signal (AZN). Configurable constant — verify with counsel. */
export const VAT_REGISTRATION_THRESHOLD_AZN = 200_000;

/** 80% of VAT registration threshold — proactive MEDIUM RiskAudit. */
export const VAT_TURNOVER_WARN_AZN = 160_000;

/** 95% of VAT registration threshold — proactive HIGH RiskAudit. */
export const VAT_TURNOVER_CRITICAL_AZN = 190_000;

/** @deprecated Use VAT_TURNOVER_WARN_AZN / VAT_TURNOVER_CRITICAL_AZN (TaxLimitService). */
export const VAT_THRESHOLD_MEDIUM_RATIO = 0.7;

/** @deprecated Use VAT_TURNOVER_WARN_AZN / VAT_TURNOVER_CRITICAL_AZN (TaxLimitService). */
export const VAT_THRESHOLD_HIGH_RATIO = 0.85;

/** Large RKO amount (AZN) for fraud chain heuristic. */
export const FRAUD_LARGE_CASH_WITHDRAWAL_AZN = 10_000;

/** Minimum password-profile PATCH events per user in window for fraud signal. */
export const FRAUD_MIN_PROFILE_PATCHES = 3;

/** Window for fraud pattern scan (hours). */
export const FRAUD_SCAN_WINDOW_HOURS = 72;

/** Large sales to non-VAT-registered counterparty (AZN sum YTD) — compliance heuristic. */
export const LARGE_SALE_NON_VAT_PAYER_AZN = 50_000;
