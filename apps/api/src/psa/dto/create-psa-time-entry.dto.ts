import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from "class-validator";

export class CreatePsaTimeEntryDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiProperty({ example: "2026-05-01" })
  @IsDateString()
  date!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  hours!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}
