import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

const SOURCES = ["KASSA", "FOUNDER"] as const;

export class CreateCashDepositDto {
  @ApiProperty()
  @IsUUID()
  targetBankAccountId!: string;

  @ApiProperty({ example: 1200 })
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 },
    { message: "amount must be a finite number" },
  )
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: SOURCES })
  @IsIn(SOURCES)
  source!: (typeof SOURCES)[number];

  @ApiProperty({ example: "2026-05-05" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  description?: string;
}
