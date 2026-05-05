import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

const CURRENCIES = ["AZN", "USD", "EUR", "RUB", "TRY"] as const;
const ACCOUNT_TYPES = [
  "MAIN",
  "SALARY",
  "CARD",
  "TENDER",
  "CREDIT",
  "VAT_DEPOSIT",
] as const;

export class CreateOrganizationBankAccountDto {
  @ApiProperty({ example: "AZ41NABZ01350100000000001944" })
  @IsString()
  @Transform(({ value }) => String(value ?? "").replace(/\s+/g, "").toUpperCase())
  @Matches(/^AZ[0-9A-Z]{26}$/, { message: "iban must match AZ + 26 alphanumeric chars" })
  iban!: string;

  @ApiProperty({ example: "Kapital Bank" })
  @IsString()
  @MaxLength(200)
  bankName!: string;

  @ApiPropertyOptional({ example: "AIIBAZ2X" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  swift?: string | null;

  @ApiPropertyOptional({ enum: CURRENCIES, default: "AZN" })
  @IsOptional()
  @IsString()
  @IsIn(CURRENCIES)
  @Transform(({ value }) => String(value ?? "AZN").toUpperCase())
  currency?: (typeof CURRENCIES)[number];

  @ApiProperty({ example: "222.01.01" })
  @IsString()
  @Matches(/^(221|222|223|224|225)(\.\d{2}){0,4}$/)
  ledgerAccountCode!: string;

  @ApiPropertyOptional({ enum: ACCOUNT_TYPES, default: "MAIN" })
  @IsOptional()
  @IsString()
  @IsIn(ACCOUNT_TYPES)
  accountType?: (typeof ACCOUNT_TYPES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFrozen?: boolean;
}
