import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
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

export class CreateInvoiceItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @ApiPropertyOptional({
    description: "Код единицы измерения из каталога (pcs, kg, m, …); иначе берётся с товара при productId",
  })
  @IsOptional()
  @IsString()
  unitOfMeasureCode?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  unitPrice!: number;

  @ApiProperty({ description: "Ставка НДС строки: -1 (освобождение), 0, 2, 8 или 18 (%)" })
  @Type(() => Number)
  @IsNumber()
  @IsIn([-1, 0, 2, 8, 18])
  vatRate!: number;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;

  @ApiProperty({ example: "2026-04-15" })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ enum: ["101", "221"], default: "101" })
  @IsOptional()
  @IsString()
  @IsIn(["101", "221"])
  debitAccountCode?: string;

  @ApiPropertyOptional({ description: "Склад отгрузки (остатки / списание при оплате)" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];

  @ApiPropertyOptional({
    enum: ["AZN", "USD", "EUR", "RUB", "TRY", "GBP", "KZT", "UAH", "GEL"],
    default: "AZN",
  })
  @IsOptional()
  @IsIn(["AZN", "USD", "EUR", "RUB", "TRY", "GBP", "KZT", "UAH", "GEL"])
  currency?: string;

  @ApiPropertyOptional({
    description: "true — цена строк указана с НДС (брутто за единицу)",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  vatInclusive?: boolean;

  @ApiPropertyOptional({
    description: "Курс валюты счёта к AZN (информативно / будущие проводки; для AZN = 1)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0000001)
  fxRateToAzn?: number;

  @ApiPropertyOptional({
    description: "International (export) invoice. Skips local DVX prefill flow.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isInternational?: boolean;

  @ApiPropertyOptional({ description: "PSA / project link (optional)" })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
