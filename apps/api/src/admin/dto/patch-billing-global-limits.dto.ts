import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class BillingGlobalQuotaUnitDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  employeeBlockSize!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerEmployeeBlockAzn!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  documentPackSize!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerDocumentPackAzn!: number;
}

export class BillingGlobalTierLegacyPricesDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  STARTER!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  BUSINESS!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  ENTERPRISE!: number;
}

export class PatchBillingGlobalLimitsDto {
  @ApiProperty({ description: "Yearly billing discount 0–100" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  yearlyDiscountPercent!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ocrJobsPerOrgMonth!: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BillingGlobalQuotaUnitDto)
  quotaPricing!: BillingGlobalQuotaUnitDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BillingGlobalTierLegacyPricesDto)
  tierPrices!: BillingGlobalTierLegacyPricesDto;
}
