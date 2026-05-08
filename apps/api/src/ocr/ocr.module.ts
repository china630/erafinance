import { Module } from "@nestjs/common";
import { OcrController } from "./ocr.controller";
import { OcrService } from "./ocr.service";
import { OcrQueueService } from "./ocr.queue";
import { OcrWorker } from "./ocr.worker";
import { OpenAiOcrProvider } from "./openai-ocr.provider";
import { GeminiOcrProvider } from "./gemini-ocr.provider";

@Module({
  controllers: [OcrController],
  providers: [OcrService, OcrQueueService, OcrWorker, OpenAiOcrProvider, GeminiOcrProvider],
  exports: [OcrService],
})
export class OcrModule {}
