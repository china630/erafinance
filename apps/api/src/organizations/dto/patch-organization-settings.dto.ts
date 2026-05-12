import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import {
  InventoryValuationMethod,
} from "@erafinance/database";

export class OrganizationBankAccountInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(200)
  bankName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn(["AZN", "USD", "EUR", "RUB", "TRY"])
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  iban?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  swift?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ledgerAccountCode?: string;

  @IsOptional()
  @IsString()
  @IsIn(["MAIN", "SALARY", "CARD", "TENDER", "CREDIT", "VAT_DEPOSIT"])
  accountType?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsBoolean()
  isFrozen?: boolean;
}

export class PatchOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  legalAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  directorName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string | null;

  @IsOptional()
  @IsEnum(InventoryValuationMethod)
  valuationMethod?: InventoryValuationMethod;

  @IsOptional()
  @IsEnum(InventoryValuationMethod)
  inventoryValuation?: InventoryValuationMethod;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrganizationBankAccountInputDto)
  bankAccounts?: OrganizationBankAccountInputDto[];

  @IsOptional()
  @IsDateString()
  lockedPeriodUntil?: string | null;
}
