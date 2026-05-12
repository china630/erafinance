import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class BackdatingQueryDto {
  @ApiPropertyOptional({ description: "ISO date (inclusive)" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date (inclusive)" })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description:
      "Minimum calendar days between document date and createdAt (entry into system)",
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  thresholdDays?: number = 1;

  @ApiPropertyOptional({
    description: "Comma-separated: invoice,transaction",
  })
  @IsOptional()
  @IsString()
  entityTypes?: string;
}
