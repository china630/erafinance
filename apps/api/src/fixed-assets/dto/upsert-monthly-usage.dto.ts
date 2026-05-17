import { IsInt, IsNumber, IsPositive, Max, Min } from "class-validator";

export class UpsertFixedAssetMonthlyUsageDto {
  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsNumber()
  @IsPositive()
  periodUnits!: number;
}
