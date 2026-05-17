import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsPositive,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class BulkMonthlyUsageEntryDto {
  @IsUUID()
  fixedAssetId!: string;

  @IsNumber()
  @IsPositive()
  periodUnits!: number;
}

export class BulkFixedAssetMonthlyUsageDto {
  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkMonthlyUsageEntryDto)
  entries!: BulkMonthlyUsageEntryDto[];
}
