import { PartialType } from "@nestjs/swagger";
import { UpsertChartTemplateEntryDto } from "./upsert-chart-template-entry.dto";

/** PATCH body for NAS catalog row (immutable: composite kind+code via upsert). */
export class PatchChartTemplateEntryDto extends PartialType(UpsertChartTemplateEntryDto) {}
