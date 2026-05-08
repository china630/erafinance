import { OcrService } from "./ocr.service";

describe("OcrService", () => {
  it("selects openai by default", () => {
    const service = new OcrService(
      {} as any,
      {} as any,
      { get: () => undefined } as any,
      { name: "openai" } as any,
      { name: "gemini" } as any,
      {} as any,
      {} as any,
    );
    expect(service.pickProvider().name).toBe("openai");
  });
});
