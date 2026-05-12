import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreateAuditSampleDto {
  @ApiProperty({
    enum: [
      "sales_invoices",
      "transactions",
      "customs_declarations",
      "ocr_jobs",
    ],
  })
  @IsString()
  @IsIn(["sales_invoices", "transactions", "customs_declarations", "ocr_jobs"])
  scope!: string;

  @ApiProperty({ description: "Period start (ISO date)" })
  @IsString()
  periodFrom!: string;

  @ApiProperty({ description: "Period end (ISO date)" })
  @IsString()
  periodTo!: string;

  @ApiProperty({ enum: ["random", "materiality"] })
  @IsString()
  @IsIn(["random", "materiality"])
  mode!: "random" | "materiality";

  @ApiPropertyOptional({ description: "For random mode: 1–100 percent of rows" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  percent?: number;

  @ApiPropertyOptional({ description: "For materiality: minimum absolute total" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  thresholdAmount?: number;

  @ApiPropertyOptional({ default: "AZN" })
  @IsOptional()
  @IsString()
  currency?: string = "AZN";

  @ApiPropertyOptional({ description: "Optional seed for reproducible random sample" })
  @IsOptional()
  @IsString()
  seed?: string;
}
