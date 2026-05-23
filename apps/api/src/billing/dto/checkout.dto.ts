import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  Max,
  Min,
  MinLength,
  IsOptional,
} from "class-validator";
import { TariffTier } from "@erafinance/database";

export class CheckoutDto {
  /** Default: PAŞA Bank redirect / mock. Use `drakaris` for yığım integration. */
  @IsOptional()
  @IsIn(["pasha_bank", "drakaris"])
  provider?: "pasha_bank" | "drakaris";

  /** Если задан — сумма заказа берётся из SystemConfig для тарифа. */
  @IsOptional()
  @IsEnum(TariffTier)
  tier?: TariffTier;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountAzn!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @IsOptional()
  @MinLength(8)
  idempotencyKey?: string;
}

