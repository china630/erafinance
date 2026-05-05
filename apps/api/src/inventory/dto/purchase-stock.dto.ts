import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

/** Line-level VAT mode for purchase invoice (ƏDV); maps to percentage for posting. */
export type PurchaseLineVatMode = "18" | "0" | "exempt" | "not_applicable";

export class PurchaseLineDto {
  @ApiProperty()
  @IsUUID(undefined, { message: "productId must be a valid UUID" })
  productId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({}, { message: "quantity must be a number" })
  @Min(0.0001, { message: "quantity must be greater than 0" })
  quantity!: number;

  @ApiProperty({ description: "Цена закупки за единицу (без НДС или с НДС — см. pricesIncludeVat)" })
  @Type(() => Number)
  @IsNumber({}, { message: "unitPrice must be a number" })
  @Min(0, { message: "unitPrice must be >= 0" })
  unitPrice!: number;

  @ApiPropertyOptional({
    enum: ["18", "0", "exempt", "not_applicable"],
    description:
      "ƏDV mode for the line (UI). If omitted, product catalog vatRate is used for backward compatibility.",
  })
  @IsOptional()
  @IsIn(["18", "0", "exempt", "not_applicable"])
  vatMode?: PurchaseLineVatMode;

  @ApiPropertyOptional({
    description:
      "Deprecated: purchase invoice no longer posts stock; binId is ignored if sent.",
  })
  @IsOptional()
  @IsUUID()
  binId?: string;
}

export class PurchaseStockDto {
  @ApiPropertyOptional({
    enum: ["goods", "services"],
    description:
      "Legacy single-table mode: use with `lines`. Prefer `goodsLines` + `serviceLines` for dual-list.",
  })
  @IsOptional()
  @IsIn(["goods", "services"])
  kind?: "goods" | "services";

  @ApiPropertyOptional({
    type: [PurchaseLineDto],
    description: "Dual-list: товары (Mallar). Mutually exclusive with legacy `lines` when both new arrays are sent.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  goodsLines?: PurchaseLineDto[];

  @ApiPropertyOptional({
    type: [PurchaseLineDto],
    description: "Dual-list: услуги (Xidmətlər).",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  serviceLines?: PurchaseLineDto[];

  @ApiPropertyOptional({
    type: [PurchaseLineDto],
    description: "Legacy: single block; use with `kind`.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines?: PurchaseLineDto[];

  @ApiPropertyOptional({
    description: "Deprecated: warehouse is not used for purchase invoice posting; ignored if sent.",
  })
  @IsOptional()
  @IsUUID(undefined, { message: "warehouseId must be a valid UUID" })
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: "Поставщик (для аналитики кредиторки 531 и взаимозачёта)",
  })
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @ApiPropertyOptional({
    description:
      "Если true: unitPrice в строках указан с НДС; на склад и в 201/731 попадает сумма без НДС, НДС — на 241",
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pricesIncludeVat?: boolean;

  @ApiPropertyOptional({
    enum: ["AZN", "USD", "EUR", "TRY", "RUB"],
    description: "Валюта документа; проводки в AZN после умножения на fxRateToAzn.",
  })
  @IsOptional()
  @IsIn(["AZN", "USD", "EUR", "TRY", "RUB"])
  currency?: string;

  @ApiPropertyOptional({
    description: "Курс документной валюты к AZN (для проводок). Для AZN должен быть 1.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0000001, { message: "fxRateToAzn must be > 0" })
  fxRateToAzn?: number;

  @ApiPropertyOptional({ description: "Дата документа (ISO); по умолчанию — текущее время сервера" })
  @IsOptional()
  @IsDateString()
  documentDate?: string;
}
