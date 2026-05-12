import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { AccountType, OrganizationKind } from "@erafinance/database";

export class UpsertTemplateAccountDto {
  @ApiPropertyOptional({ enum: OrganizationKind })
  @IsOptional()
  @IsEnum(OrganizationKind)
  kind?: OrganizationKind;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  nameAz!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  nameRu!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  nameEn!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  accountType!: AccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  cashProfile?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDeprecated?: boolean;
}

export class PatchTemplateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  nameAz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  nameRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  nameEn?: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  cashProfile?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDeprecated?: boolean;
}
