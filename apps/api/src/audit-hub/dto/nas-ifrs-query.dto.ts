import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class NasIfrsQueryDto {
  @ApiPropertyOptional({ description: "ISO date inclusive (transaction.date)" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date inclusive" })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ default: 200, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number = 200;

  @ApiPropertyOptional({
    description:
      "When true, also return transactions where both NAS and IFRS exist but total debits differ (v2 heuristic)",
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "1" || value === "true")
  @IsBoolean()
  includeTotalsMismatch?: boolean = false;
}
