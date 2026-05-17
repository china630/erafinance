import type {
  CouncilSynthesizerOutput,
  ElderVerdictsBundle,
} from "@erafinance/api-contracts";
import type { RiskSeverity } from "@erafinance/database";

export const COUNCIL_TRIGGER_SOURCES = [
  "MANUAL",
  "TAX_LIMIT_HIT",
  "HIGH_VALUE_TRANSACTION",
  "VOEN_RISKY_COUNTERPARTY",
  "WEEKLY_CRON",
  "PRE_TAX_CRON",
] as const;

export type CouncilTriggerSource = (typeof COUNCIL_TRIGGER_SOURCES)[number];

export const COUNCIL_TARGET_ENTITY_TYPES = [
  "ORGANIZATION",
  "RISK_AUDIT",
  "INVOICE",
  "CASH_ORDER",
  "LEDGER_PERIOD",
] as const;

export type CouncilTargetEntityType =
  (typeof COUNCIL_TARGET_ENTITY_TYPES)[number];

export type CouncilTargetRef = {
  entityType: CouncilTargetEntityType;
  entityId?: string | null;
  label: string;
};

export type CouncilDeliberationJobPayload = {
  verdictId: string;
  organizationId: string;
};

export type CouncilSnapshot = {
  organizationToken: string;
  triggerSource: CouncilTriggerSource;
  target: CouncilTargetRef;
  fiscalYear: number;
  context: Record<string, unknown>;
};

export type CouncilConsensusResult = {
  elderVerdicts: ElderVerdictsBundle;
  finalScore: number;
  finalSeverity: RiskSeverity;
};

export type CouncilDeliberationResult = CouncilConsensusResult & {
  synthesizer: CouncilSynthesizerOutput;
};

export type DeliberateCouncilInput = {
  organizationId: string;
  triggerSource: CouncilTriggerSource;
  target: CouncilTargetRef;
  riskAuditId?: string | null;
  requestedByUserId?: string | null;
  dedupeKey?: string | null;
};
