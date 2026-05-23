import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { TariffTier } from "@erafinance/database";
import { TierQuotasDto } from "./set-tier-quotas.dto";

export class BillingQuotasMatrixDto {
  @ValidateNested()
  @Type(() => TierQuotasDto)
  TIER_0!: TierQuotasDto;

  @ValidateNested()
  @Type(() => TierQuotasDto)
  TIER_1!: TierQuotasDto;

  @ValidateNested()
  @Type(() => TierQuotasDto)
  TIER_2!: TierQuotasDto;

  @ValidateNested()
  @Type(() => TierQuotasDto)
  TIER_3!: TierQuotasDto;
}

export class SetBillingQuotasMatrixDto {
  @ValidateNested()
  @Type(() => BillingQuotasMatrixDto)
  quotas!: BillingQuotasMatrixDto;
}

export function quotasMatrixToRecord(
  matrix: BillingQuotasMatrixDto,
): Record<TariffTier, TierQuotasDto> {
  return {
    [TariffTier.TIER_0]: matrix.TIER_0,
    [TariffTier.TIER_1]: matrix.TIER_1,
    [TariffTier.TIER_2]: matrix.TIER_2,
    [TariffTier.TIER_3]: matrix.TIER_3,
  };
}
