import { Injectable } from "@nestjs/common";
import type { ElderVerdict } from "@erafinance/api-contracts";
import { GeminiCouncilClient } from "./gemini-council.client";
import { CouncilConsensusReducer } from "./council-consensus.reducer";
import { FORENSIC_AUDITOR_SYSTEM_PROMPT } from "./prompts/forensic-auditor.prompt";
import { FINANCIAL_STRATEGIST_SYSTEM_PROMPT } from "./prompts/financial-strategist.prompt";
import { TAX_INSPECTOR_SYSTEM_PROMPT } from "./prompts/tax-inspector.prompt";
import type { CouncilSnapshot } from "./council.types";
import { COUNCIL_SNAPSHOT_MAX_CHARS } from "./council.constants";

@Injectable()
export class CouncilElderAgents {
  constructor(
    private readonly gemini: GeminiCouncilClient,
    private readonly reducer: CouncilConsensusReducer,
  ) {}

  async deliberateAll(snapshot: CouncilSnapshot) {
    const payload = this.snapshotPayload(snapshot);
    const [taxRaw, forensicRaw, strategistRaw] = await Promise.all([
      this.gemini.generateJson(TAX_INSPECTOR_SYSTEM_PROMPT, payload),
      this.gemini.generateJson(FORENSIC_AUDITOR_SYSTEM_PROMPT, payload),
      this.gemini.generateJson(FINANCIAL_STRATEGIST_SYSTEM_PROMPT, payload),
    ]);

    const tax = this.reducer.parseElderVerdict(taxRaw, "tax");
    const forensic = this.reducer.parseElderVerdict(forensicRaw, "forensic");
    const strategist = this.reducer.parseElderVerdict(strategistRaw, "strategist");

    return this.reducer.reduce(tax, forensic, strategist);
  }

  private snapshotPayload(snapshot: CouncilSnapshot): string {
    const json = JSON.stringify(snapshot);
    if (json.length <= COUNCIL_SNAPSHOT_MAX_CHARS) {
      return json;
    }
    return json.slice(0, COUNCIL_SNAPSHOT_MAX_CHARS);
  }
}
