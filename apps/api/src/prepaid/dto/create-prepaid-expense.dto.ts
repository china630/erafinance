import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreatePrepaidExpenseDto {
  @ApiProperty({ example: "1000.0000" })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  totalAmount!: string;

  @ApiPropertyOptional({ default: "AZN" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiProperty({ example: "2025-01-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2025-12-31" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @ApiPropertyOptional({ default: "731" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  expenseAccountCode?: string;

  @ApiPropertyOptional({ default: "133" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  prepaidAccountCode?: string;
}
