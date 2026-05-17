import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNumber, IsString, Min, ValidateNested } from "class-validator";

export class BillingPricingCatalogModuleDto {
  @ApiProperty({ example: "banking_pro" })
  @IsString()
  key!: string;

  @ApiProperty({ example: 19 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerMonth!: number;
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
