import { Injectable } from "@nestjs/common";
import { ForeignInvoicePrefillSchema } from "@erafinance/api-contracts";
import type { OcrVisionInput, OcrVisionProvider } from "./ocr-vision.interface";

@Injectable()
export class OpenAiOcrProvider implements OcrVisionProvider {
  readonly name = "openai" as const;

  async recognizeForeignInvoice(input: OcrVisionInput) {
    return ForeignInvoicePrefillSchema.parse({
      number: input.fileName.replace(/\.[^.]+$/, ""),
      issueDate: new Date().toISOString(),
      currency: "USD",
      supplier: { name: "OCR Supplier", country: "AZ" },
      items: [],
      totals: {},
      notes: "Stub OCR result",
    });
  }
}
