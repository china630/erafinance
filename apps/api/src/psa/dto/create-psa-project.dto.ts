import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from "class-validator";
import { ProjectBillingMode } from "@erafinance/database";

export class CreatePsaProjectDto {
  @ApiProperty({ example: "PRJ-001" })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;

  @ApiPropertyOptional({ enum: ProjectBillingMode })
  @IsOptional()
  @IsEnum(ProjectBillingMode)
  billingMode?: ProjectBillingMode;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ default: "AZN" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
