import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  FixedAssetDepreciationMethod,
  FixedAssetStatus,
} from "@erafinance/database";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export class CreateFixedAssetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "INV-001" })
  @IsString()
  @IsNotEmpty()
  inventoryNumber!: string;

  @ApiProperty({
    example: "2024-01-15",
    description: "Дата покупки/ввода в эксплуатацию (purchaseDate)",
  })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ description: "Legacy alias: commissioningDate" })
  @IsOptional()
  @IsDateString()
  commissioningDate?: string;

  @ApiProperty({ description: "Стоимость приобретения (purchasePrice)" })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  purchasePrice?: number;

  @ApiPropertyOptional({ description: "Legacy alias: initialCost" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  initialCost?: number;

  @ApiProperty({ description: "Срок полезного использования, месяцев" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usefulLifeMonths!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salvageValue?: number;

  @ApiPropertyOptional({ enum: FixedAssetStatus, default: FixedAssetStatus.ACTIVE })
  @IsOptional()
  @IsEnum(FixedAssetStatus)
  status?: FixedAssetStatus;

  @ApiPropertyOptional({ enum: FixedAssetDepreciationMethod })
  @IsOptional()
  @IsEnum(FixedAssetDepreciationMethod)
  depreciationMethod?: FixedAssetDepreciationMethod;

  @ApiPropertyOptional({
    description: "Required for UNITS_OF_PRODUCTION — total lifetime units",
  })
  @ValidateIf(
    (o: CreateFixedAssetDto) =>
      o.depreciationMethod === FixedAssetDepreciationMethod.UNITS_OF_PRODUCTION,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  totalExpectedUnits?: number;

  @ApiPropertyOptional({
    description: "Annual declining-balance rate (0–1), required for REDUCING_BALANCE",
  })
  @ValidateIf(
    (o: CreateFixedAssetDto) =>
      o.depreciationMethod === FixedAssetDepreciationMethod.REDUCING_BALANCE,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  decliningBalanceRate?: number;
}
