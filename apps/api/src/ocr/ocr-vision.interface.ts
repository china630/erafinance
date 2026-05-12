import type { ForeignInvoicePrefill } from "@erafinance/api-contracts";

export type OcrVisionInput = {
  mimeType: string;
  fileName: string;
  fileBytes: Buffer;
};

export interface OcrVisionProvider {
  readonly name: "openai" | "gemini";
  recognizeForeignInvoice(input: OcrVisionInput): Promise<ForeignInvoicePrefill>;
}
