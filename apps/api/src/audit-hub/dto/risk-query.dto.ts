import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class AuditHubRiskQueryDto {
  @ApiPropertyOptional({ description: "ISO date inclusive (cash order date)" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date inclusive" })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description: "Max calendar days between paired cash orders",
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  windowDays?: number = 7;

  @ApiPropertyOptional({ default: 100, maximum: 300 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  take?: number = 100;

  @ApiPropertyOptional({
    description: "Minimum NAS debit sum per expense account (expense spike detector)",
    default: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(1_000_000_000)
  expenseMinDebit?: number = 50_000;
}
