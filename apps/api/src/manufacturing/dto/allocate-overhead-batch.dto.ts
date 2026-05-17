import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export enum OverheadDistributionKey {
  QUANTITY = "QUANTITY",
  MATERIAL_COST = "MATERIAL_COST",
}

export class AllocateOverheadBatchDto {
  @ApiProperty({ example: "2026-05" })
  @IsString()
  period!: string;

  @ApiProperty({ description: "Total overhead pool amount (AZN)" })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  totalAmount!: number;

  @ApiProperty({ enum: OverheadDistributionKey })
  @IsEnum(OverheadDistributionKey)
  distributionKey!: OverheadDistributionKey;

  @ApiProperty({ type: [String], format: "uuid" })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  releaseIds!: string[];

  @ApiPropertyOptional({ default: "741" })
  @IsOptional()
  @IsString()
  creditAccountCode?: string;

  @ApiPropertyOptional({ default: "204" })
  @IsOptional()
  @IsString()
  debitAccountCode?: string;

  @ApiPropertyOptional({ default: "741" })
  @IsOptional()
  @IsString()
  sourceAccountCode?: string;
}
