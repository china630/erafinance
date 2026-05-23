import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class BillingPricingCatalogModuleDto {
  @ApiProperty({ example: "cash_bank_pro" })
  @IsString()
  key!: string;

  @ApiProperty({ example: 19 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerMonth!: number;

  @ApiProperty({
    example: false,
    description: "Premium add-on (trial shield, Tier 1+ activation)",
  })
  @IsBoolean()
  isPremium!: boolean;
}

export class PatchBillingPricingCatalogDto {
  @ApiProperty({ example: 29 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  foundationMonthlyAzn!: number;

  @ApiProperty({ type: [BillingPricingCatalogModuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingPricingCatalogModuleDto)
  modules!: BillingPricingCatalogModuleDto[];
}
