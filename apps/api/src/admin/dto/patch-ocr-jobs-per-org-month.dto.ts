import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class PatchOcrJobsPerOrgMonthDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  limit!: number;
}
