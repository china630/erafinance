import { Injectable } from "@nestjs/common";
import {
  ElderVerdictSchema,
  ElderVerdictsBundleSchema,
  type ElderVerdict,
} from "@erafinance/api-contracts";
import { RiskSeverity } from "@erafinance/database";
import {
  COUNCIL_ELDER_HIGH_SCORE,
  COUNCIL_ELDER_MEDIUM_SCORE,
} from "./council.constants";
import type { CouncilConsensusResult } from "./council.types";

@Injectable()
export class CouncilConsensusReducer {
  parseElderVerdict(raw: string, persona: string): ElderVerdict {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    const result = ElderVerdictSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Invalid ${persona} Elder JSON: ${result.error.message}`,
      );
    }
    return result.data;
  }

  reduce(
    tax: ElderVerdict,
    forensic: ElderVerdict,
    strategist: ElderVerdict,
  ): CouncilConsensusResult {
    const elderVerdicts = ElderVerdictsBundleSchema.parse({
      tax,
      forensic,
      strategist,
    });

    const scores = [tax.score, forensic.score, strategist.score];
    const finalScore = Math.max(...scores);

    let finalSeverity: RiskSeverity = RiskSeverity.LOW;
    if (scores.some((s) => s > COUNCIL_ELDER_HIGH_SCORE)) {
      finalSeverity = RiskSeverity.HIGH;
    } else if (scores.some((s) => s > COUNCIL_ELDER_MEDIUM_SCORE)) {
      finalSeverity = RiskSeverity.MEDIUM;
    }

    return { elderVerdicts, finalScore, finalSeverity };
  }
}
