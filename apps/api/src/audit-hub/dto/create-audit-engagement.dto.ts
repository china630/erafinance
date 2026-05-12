import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateAuditEngagementDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodTo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sampleIds?: string[];
}
