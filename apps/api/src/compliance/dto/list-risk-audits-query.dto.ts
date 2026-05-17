import { RiskAuditStatus, RiskAuditType } from "@erafinance/database";
import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListRiskAuditsQueryDto {
  @IsOptional()
  @IsEnum(RiskAuditStatus)
  status?: RiskAuditStatus;

  @IsOptional()
  @IsEnum(RiskAuditType)
  type?: RiskAuditType;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === "" ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === "" ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
