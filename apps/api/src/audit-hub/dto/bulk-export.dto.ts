import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AuditHubBulkExportDto {
  @ApiProperty()
  @IsUUID()
  sampleId!: string;
}
