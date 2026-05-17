import { Type } from "class-transformer";
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { PatchPricingBundleTrialConfigDto } from "./pricing-bundle-trial-config.dto";

export class CreatePricingBundleDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent!: number;

  @IsArray()
  @IsString({ each: true })
  moduleKeys!: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchPricingBundleTrialConfigDto)
  trial?: PatchPricingBundleTrialConfigDto;
}

export class UpdatePricingBundleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moduleKeys?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchPricingBundleTrialConfigDto)
  trial?: PatchPricingBundleTrialConfigDto;
}
