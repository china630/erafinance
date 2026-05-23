import { TariffTier } from "@erafinance/database";
import { IsEnum } from "class-validator";

export class SelectPlanDto {
  @IsEnum(TariffTier)
  tier!: TariffTier;
}

