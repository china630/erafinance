import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type, type TransformFnParams } from "class-transformer";
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

export class WarehouseReceiptLineDto {
  @ApiProperty()
  @IsUUID(undefined, { message: "productId must be a valid UUID" })
  productId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({}, { message: "quantity must be a number" })
  @Min(0.0001, { message: "quantity must be greater than 0" })
  quantity!: number;

  @ApiPropertyOptional({ description: "Warehouse bin (WMS-light); optional" })
  @IsOptional()
  @IsUUID()
  binId?: string;
}

/** Anbar mədaxil orderi — quantity-only receipt; no GL / debt. */
export class CreateWarehouseReceiptDto {
  @ApiProperty()
  @IsUUID(undefined, { message: "warehouseId must be a valid UUID" })
  warehouseId!: string;

  @ApiProperty({ description: "Business document date (ISO 8601 date or datetime)" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description:
      "Optional link to posted Alış Fakturası (Transaction.id). Alias: `referenceId`.",
  })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional({
    description:
      "Optional link to posted Alış Fakturası (Transaction.id of purchase invoice journal). If omitted, `referenceId` may be used.",
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value, obj }: TransformFnParams) => value ?? (obj as { referenceId?: string }).referenceId)
  basisTransactionId?: string;

  @ApiPropertyOptional({
    type: [WarehouseReceiptLineDto],
    description: "Alias for `lines` (same shape). Either `lines` or `items` must be non-empty.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarehouseReceiptLineDto)
  items?: WarehouseReceiptLineDto[];

  @ApiProperty({
    type: [WarehouseReceiptLineDto],
    description: "Receipt lines. JSON synonym: `items`.",
  })
  @Transform(({ value, obj }: TransformFnParams) => {
    const o = obj as { items?: WarehouseReceiptLineDto[] };
    return Array.isArray(value) && value.length > 0 ? value : o.items;
  })
  @IsArray()
  @ArrayMinSize(1, { message: "lines or items must contain at least one row" })
  @ValidateNested({ each: true })
  @Type(() => WarehouseReceiptLineDto)
  lines!: WarehouseReceiptLineDto[];
}
