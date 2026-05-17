import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { IGeminiCouncilClient } from "./interfaces/council-engine.interface";

@Injectable()
export class GeminiCouncilClient implements IGeminiCouncilClient {
  private readonly logger = new Logger(GeminiCouncilClient.name);
  private readonly modelName: string;
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim() || undefined;
    this.modelName =
      this.config.get<string>("GEMINI_COUNCIL_MODEL")?.trim() ||
      "gemini-2.0-flash";
  }

  async generateJson(systemPrompt: string, userPayload: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn("GEMINI_API_KEY missing — returning stub council JSON");
      return this.stubJson(systemPrompt);
    }

    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent(userPayload);
        const text = result.response.text();
        if (!text?.trim()) {
          throw new Error("Empty Gemini response");
        }
        return text.trim();
      } catch (e) {
        lastErr = e;
        this.logger.warn(
          `Gemini council attempt ${attempt + 1} failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private stubJson(systemPrompt: string): string {
    if (systemPrompt.includes("Synthesizer")) {
      return JSON.stringify({
        summaryAz:
          "Şura nəticəsi (stub): risk siqnalları yoxlanılmalıdır. GEMINI_API_KEY təyin edin.",
        summaryRu:
          "Результат совета (stub): проверьте сигналы риска. Укажите GEMINI_API_KEY.",
        suggestedAction: "Review flagged transactions and document mitigation steps.",
      });
    }
    return JSON.stringify({
      score: 45,
      stance: "watch",
      findings: ["Stub Elder verdict — configure GEMINI_API_KEY for live analysis."],
      reasoning: "Development stub response.",
    });
  }
}
