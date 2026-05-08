import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateReconciliationDraftDto {
  @ApiProperty({ example: "2026-04-03" })
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  number?: string;

  @ApiPropertyOptional({ description: "Материально ответственное лицо (опционально)" })
  @IsOptional()
  @IsUUID()
  responsibleEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
