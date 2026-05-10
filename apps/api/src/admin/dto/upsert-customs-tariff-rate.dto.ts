import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertCustomsTariffRateDto {
  @ApiProperty({ description: "HS chapter or code prefix (digits only, e.g. 85 or 8501)" })
  @IsString()
  hsCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ example: 15 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  dutyRatePercent!: number;

  @ApiProperty({ example: 18 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRatePercent!: number;

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  excisePercent?: number;

  @ApiPropertyOptional({ description: "ISO date. Row identity is (hsCode, effectiveFrom); same hs + new date = new revision." })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}
