import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { TaxRateKind } from "@erafinance/database";

export class CreateTaxRateDto {
  @ApiProperty({ example: "EDV_5" })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,62}$/)
  code!: string;

  @ApiProperty({ enum: TaxRateKind })
  @IsEnum(TaxRateKind)
  kind!: TaxRateKind;

  @ApiPropertyOptional({ default: "AZ" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  region?: string;

  @ApiProperty({ example: 18 })
  @Type(() => Number)
  percent!: number;

  @ApiProperty({ example: "2024-01-01" })
  @IsISO8601({ strict: false })
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: false })
  effectiveTo?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  nameAz!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  nameRu!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  nameEn!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PatchTaxRateDto {
  @ApiPropertyOptional({ enum: TaxRateKind })
  @IsOptional()
  @IsEnum(TaxRateKind)
  kind?: TaxRateKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: false })
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  effectiveTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nameAz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nameRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
