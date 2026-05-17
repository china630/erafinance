import type {
  CouncilDeliberationJobPayload,
  CouncilDeliberationResult,
  CouncilSnapshot,
  DeliberateCouncilInput,
} from "../council.types";

export interface IGeminiCouncilClient {
  generateJson(systemPrompt: string, userPayload: string): Promise<string>;
}

export interface IElderAgent {
  readonly persona: "tax" | "forensic" | "strategist";
  deliberate(snapshot: CouncilSnapshot): Promise<import("@erafinance/api-contracts").ElderVerdict>;
}

export interface ICouncilDispatcher {
  deliberate(input: DeliberateCouncilInput): Promise<{ verdictId: string }>;
  enqueueExisting(verdictId: string, organizationId: string): Promise<void>;
}

export interface ICouncilEngine {
  runDeliberation(payload: CouncilDeliberationJobPayload): Promise<void>;
  buildResult(snapshot: CouncilSnapshot): Promise<CouncilDeliberationResult>;
}
