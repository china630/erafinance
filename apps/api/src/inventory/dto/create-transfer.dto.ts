import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

/** One transfer line: OUT from source warehouse/bin, IN to target warehouse/bin. */
export class TransferLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001, { message: "quantity must be greater than 0" })
  quantity!: number;

  @ApiProperty()
  @IsUUID()
  sourceWarehouseId!: string;

  @ApiPropertyOptional({
    description: "Source bin; omit or null for warehouse-level (no bin) bucket.",
  })
  @IsOptional()
  @IsUUID()
  sourceBinId?: string | null;

  @ApiProperty()
  @IsUUID()
  targetWarehouseId!: string;

  @ApiPropertyOptional({
    description: "Target bin; omit or null for warehouse-level bucket.",
  })
  @IsOptional()
  @IsUUID()
  targetBinId?: string | null;
}

/** Yerdəyişmə — internal stock transfer document (no GL). */
export class CreateTransferDto {
  @ApiProperty({
    description: "Business document date (ISO 8601 date or datetime)",
  })
  @IsDateString()
  date!: string;

  @ApiProperty({ type: [TransferLineDto] })
  @IsArray()
  @ArrayMinSize(1, { message: "lines must contain at least one row" })
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines!: TransferLineDto[];
}
