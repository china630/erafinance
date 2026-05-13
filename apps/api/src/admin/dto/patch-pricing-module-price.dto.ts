import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class PatchPricingModulePriceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerMonth!: number;
}
