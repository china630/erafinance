import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const MITIGATED = "MITIGATED" as const;
const IGNORED = "IGNORED" as const;

export class PatchRiskAuditDto {
  @ApiProperty({ enum: [MITIGATED, IGNORED] })
  @IsIn([MITIGATED, IGNORED])
  status!: typeof MITIGATED | typeof IGNORED;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  mitigationNote?: string;
}
