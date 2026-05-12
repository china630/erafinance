import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InventoryAuditStatus } from "@erafinance/database";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from "class-validator";

export class CreateInventoryAuditDto {
  @ApiProperty({ example: "2026-04-03" })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: "Склад (одна опись — один физический склад)" })
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional({
    enum: InventoryAuditStatus,
    default: InventoryAuditStatus.DRAFT,
    description: "Only DRAFT is supported; use /inventory/reconciliations for the full workflow",
  })
  @IsOptional()
  @IsEnum(InventoryAuditStatus)
  status?: InventoryAuditStatus;
}
