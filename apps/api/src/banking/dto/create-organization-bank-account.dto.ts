import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import {
  ORGANIZATION_BANK_ACCOUNT_CURRENCIES,
  ORGANIZATION_BANK_ACCOUNT_TYPES,
} from "@erafinance/api-contracts";

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

  @ApiPropertyOptional({ enum: ORGANIZATION_BANK_ACCOUNT_CURRENCIES, default: "AZN" })
  @IsOptional()
  @IsString()
  @IsIn(ORGANIZATION_BANK_ACCOUNT_CURRENCIES)
  @Transform(({ value }) => String(value ?? "AZN").toUpperCase())
  currency?: (typeof ORGANIZATION_BANK_ACCOUNT_CURRENCIES)[number];

  /**
   * Bank branch from system glossary (`BankBranch.id`).
   *
   * When provided and `ledgerAccountCode` is omitted, AccountingService
   * auto-generates a NAS subaccount under mask `221.<bankCode>.<seq>` and
   * assigns it to this organization bank account (TZ §6.0 / §14.0.1).
   */
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  bankBranchId?: string;

  @ApiPropertyOptional({
    description:
      "Optional NAS ledger code (221/222/223/224/225). If omitted, must provide `bankBranchId` so the system can auto-generate `221.<bankCode>.<seq>`.",
    example: "222.01.01",
  })
  @IsOptional()
  @IsString()
  @Matches(/^(221|222|223|224|225)(\.\d{2}){0,4}$/)
  ledgerAccountCode?: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_BANK_ACCOUNT_TYPES, default: "MAIN" })
  @IsOptional()
  @IsString()
  @IsIn(ORGANIZATION_BANK_ACCOUNT_TYPES)
  accountType?: (typeof ORGANIZATION_BANK_ACCOUNT_TYPES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFrozen?: boolean;
}

