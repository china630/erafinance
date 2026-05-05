import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class CreateBankConversionDto {
  @ApiProperty()
  @IsUUID()
  sourceBankAccountId!: string;

  @ApiProperty()
  @IsUUID()
  targetBankAccountId!: string;

  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 },
    { message: "sourceAmount must be a finite number" },
  )
  @Min(0.01)
  sourceAmount!: number;

  @ApiProperty({ example: 584.12 })
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 },
    { message: "targetAmount must be a finite number" },
  )
  @Min(0.01)
  targetAmount!: number;

  @ApiProperty({ example: "2026-05-05" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: 3.25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 },
    { message: "commissionAmount must be a finite number" },
  )
  @Min(0)
  commissionAmount?: number;
}
