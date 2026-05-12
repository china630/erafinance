import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InventoryDiscrepancyKind } from "@erafinance/database";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class ClassifyReconciliationLineDto {
  @ApiProperty({ enum: InventoryDiscrepancyKind })
  @IsEnum(InventoryDiscrepancyKind)
  discrepancyKind!: InventoryDiscrepancyKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountableEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reasonNote?: string;
}
