import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";
import { TariffTier } from "@erafinance/database";

export class TierQuotasDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxEmployees?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxInvoicesPerMonth?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStorageGb?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxWhatsappAlertsPerMonth?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxOcrPagesPerMonth?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxWorkspaces?: number | null;
}

export class SetTierQuotasDto {
  @IsEnum(TariffTier)
  tier!: TariffTier;

  @ValidateNested()
  @Type(() => TierQuotasDto)
  quotas!: TierQuotasDto;
}

