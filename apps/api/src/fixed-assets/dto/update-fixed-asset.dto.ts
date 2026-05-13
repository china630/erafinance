import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  FixedAssetDepreciationMethod,
  FixedAssetStatus,
} from "@erafinance/database";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UpdateFixedAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inventoryNumber?: string;

  @ApiPropertyOptional({ description: "Дата покупки/ввода (purchaseDate)" })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ description: "Legacy alias: commissioningDate" })
  @IsOptional()
  @IsDateString()
  commissioningDate?: string;

  @ApiPropertyOptional({ description: "Стоимость приобретения (purchasePrice)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  purchasePrice?: number;

  @ApiPropertyOptional({ description: "Legacy alias: initialCost" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  initialCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usefulLifeMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salvageValue?: number;

  @ApiPropertyOptional({ enum: FixedAssetStatus })
  @IsOptional()
  @IsEnum(FixedAssetStatus)
  status?: FixedAssetStatus;

  @ApiPropertyOptional({ enum: FixedAssetDepreciationMethod })
  @IsOptional()
  @IsEnum(FixedAssetDepreciationMethod)
  depreciationMethod?: FixedAssetDepreciationMethod;

  @ApiPropertyOptional({ description: "Total lifetime units (UNITS_OF_PRODUCTION)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  totalExpectedUnits?: number;

  @ApiPropertyOptional({
    description: "Annual declining-balance rate 0–1 (REDUCING_BALANCE)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  decliningBalanceRate?: number;
}
