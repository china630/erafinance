import { Type } from "class-transformer";
import { IsEnum, IsNumber, Min } from "class-validator";
import { SubscriptionTier } from "@erafinance/database";

export class SetBillingPriceDto {
  @IsEnum(SubscriptionTier)
  tier!: SubscriptionTier;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountAzn!: number;
}
