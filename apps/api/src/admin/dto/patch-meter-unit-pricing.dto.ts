import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class PatchMeterUnitPricingDto {
  @ApiProperty({ description: "AZN per active user / month" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerUserMonthAzn!: number;

  @ApiProperty({ description: "AZN per GB storage / month" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerGbMonthAzn!: number;

  @ApiProperty({ description: "AZN per WhatsApp alert" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerWhatsappAlertAzn!: number;

  @ApiProperty({ description: "AZN per invoice (Baku month)" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerInvoiceAzn!: number;

  @ApiProperty({ description: "AZN per OCR page" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerOcrPageAzn!: number;
}
