import { Type } from "class-transformer";
import { IsEnum, IsNumber, Min } from "class-validator";
import { TariffTier } from "@erafinance/database";

export class SetBillingPriceDto {
  @IsEnum(TariffTier)
  tier!: TariffTier;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountAzn!: number;
}

