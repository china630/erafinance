import { ApiPropertyOptional } from "@nestjs/swagger";
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
import { ProjectBillingMode, ProjectStatus } from "@erafinance/database";

export class UpdatePsaProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: ProjectBillingMode })
  @IsOptional()
  @IsEnum(ProjectBillingMode)
  billingMode?: ProjectBillingMode;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourlyRate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
