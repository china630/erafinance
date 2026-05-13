import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export class PatchPricingBundleTrialConfigDto {
  @ApiPropertyOptional({
    description: "When true, unsets isTrialDefault on all other bundles",
  })
  @IsOptional()
  @IsBoolean()
  isTrialDefault?: boolean;

  @ApiPropertyOptional({
    description: "Trial length in days; null clears (use platform default in code)",
  })
  @IsOptional()
  @Allow()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  trialDurationDays?: number | null;

  @ApiPropertyOptional({
    description: "JSON quota overrides for trial; null clears",
  })
  @IsOptional()
  @Allow()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsObject()
  trialQuotas?: Record<string, unknown> | null;
}
