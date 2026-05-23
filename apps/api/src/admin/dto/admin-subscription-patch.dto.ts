import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { TariffTier } from "@erafinance/database";

export class AdminSubscriptionPatchDto {
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @IsOptional()
  @IsEnum(TariffTier)
  tier?: TariffTier;

  /** ISO-8601 или null — сброс даты окончания. */
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  /** Продлить от max(сейчас, текущий expiresAt) на N месяцев. */
  @IsOptional()
  @IsInt()
  @Min(1)
  extendMonths?: number;

  /** Slugs модулей (production, ifrs, banking_pro и т.д.) — полная замена списка. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activeModules?: string[];

  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;
}

