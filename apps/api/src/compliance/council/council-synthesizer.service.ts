import { Injectable } from "@nestjs/common";
import {
  CouncilSynthesizerOutputSchema,
  type CouncilSynthesizerOutput,
  type ElderVerdictsBundle,
} from "@erafinance/api-contracts";
import { GeminiCouncilClient } from "./gemini-council.client";
import { SYNTHESIZER_SYSTEM_PROMPT } from "./prompts/synthesizer.prompt";

@Injectable()
export class CouncilSynthesizerService {
  constructor(private readonly gemini: GeminiCouncilClient) {}

  async synthesize(elderVerdicts: ElderVerdictsBundle): Promise<CouncilSynthesizerOutput> {
    const raw = await this.gemini.generateJson(
      SYNTHESIZER_SYSTEM_PROMPT,
      JSON.stringify({ elders: elderVerdicts }),
    );
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    const result = CouncilSynthesizerOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid synthesizer JSON: ${result.error.message}`);
    }
    return result.data;
  }
}
