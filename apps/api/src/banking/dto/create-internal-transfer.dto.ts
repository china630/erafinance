import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class CreateInternalTransferDto {
  @ApiProperty()
  @IsUUID()
  sourceBankAccountId!: string;

  @ApiProperty()
  @IsUUID()
  targetBankAccountId!: string;

  @ApiProperty({ example: 1500.25 })
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 },
    { message: "amount must be a finite number" },
  )
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: "2026-05-05" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: 5.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 },
    { message: "commissionAmount must be a finite number" },
  )
  @Min(0)
  commissionAmount?: number;
}
