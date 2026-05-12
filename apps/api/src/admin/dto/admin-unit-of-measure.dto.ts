import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { UnitOfMeasureKind } from "@erafinance/database";

export class CreateUnitOfMeasureDto {
  @ApiProperty({ example: "PCS" })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,32}$/)
  code!: string;

  @ApiProperty({ enum: UnitOfMeasureKind })
  @IsEnum(UnitOfMeasureKind)
  kind!: UnitOfMeasureKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  baseCode?: string | null;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  factor?: number;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  nameAz!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  nameRu!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  nameEn!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class PatchUnitOfMeasureDto {
  @ApiPropertyOptional({ enum: UnitOfMeasureKind })
  @IsOptional()
  @IsEnum(UnitOfMeasureKind)
  kind?: UnitOfMeasureKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  baseCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  factor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameAz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
