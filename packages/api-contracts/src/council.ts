import { z } from "zod";

export const ElderStanceSchema = z.enum(["clear", "watch", "high_risk"]);

export const ElderVerdictSchema = z.object({
  score: z.number().int().min(0).max(100),
  stance: ElderStanceSchema,
  findings: z.array(z.string()),
  reasoning: z.string(),
});

export const ElderVerdictsBundleSchema = z.object({
  tax: ElderVerdictSchema,
  forensic: ElderVerdictSchema,
  strategist: ElderVerdictSchema,
});

export const CouncilSynthesizerOutputSchema = z.object({
  summaryAz: z.string(),
  summaryRu: z.string(),
  suggestedAction: z.string(),
});

export type ElderVerdict = z.infer<typeof ElderVerdictSchema>;
export type ElderVerdictsBundle = z.infer<typeof ElderVerdictsBundleSchema>;
export type CouncilSynthesizerOutput = z.infer<typeof CouncilSynthesizerOutputSchema>;
