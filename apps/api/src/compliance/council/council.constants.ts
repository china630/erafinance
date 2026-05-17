/** Any Elder score above this → final HIGH severity. */
export const COUNCIL_ELDER_HIGH_SCORE = 80;

/** Any Elder score above this (and none above HIGH) → final MEDIUM. */
export const COUNCIL_ELDER_MEDIUM_SCORE = 60;

/** Default large single-transaction trigger (AZN). */
export const COUNCIL_LARGE_TRANSACTION_AZN_DEFAULT = 50_000;

/** Max anonymized snapshot JSON length sent to Gemini. */
export const COUNCIL_SNAPSHOT_MAX_CHARS = 12_000;

/** Elder personas for logging and prompts. */
export const ELDER_PERSONAS = {
  TAX: "tax",
  FORENSIC: "forensic",
  STRATEGIST: "strategist",
} as const;

export type ElderPersonaKey =
  (typeof ELDER_PERSONAS)[keyof typeof ELDER_PERSONAS];
