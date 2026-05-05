import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class ListAbsencesQueryDto {
  @ApiPropertyOptional({
    description: "Начало периода (YYYY-MM-DD), фильтр по пересечению с интервалом отсутствия",
    example: "2026-01-01",
  })
  @IsOptional()
  @IsDateString({ strict: false })
  dateFrom?: string;

  @ApiPropertyOptional({
    description: "Конец периода (YYYY-MM-DD)",
    example: "2026-01-31",
  })
  @IsOptional()
  @IsDateString({ strict: false })
  dateTo?: string;

  @ApiPropertyOptional({
    description:
      "Фильтр по подразделению (игнорируется для DEPARTMENT_HEAD — действует их область)",
  })
  @IsOptional()
  @IsUUID("4")
  departmentId?: string;
}
