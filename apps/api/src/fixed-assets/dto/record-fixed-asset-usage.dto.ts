import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class RecordFixedAssetUsageDto {
  @ApiProperty({
    description: "Units produced in this recording (UNITS_OF_PRODUCTION only)",
    example: 100,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  periodUnits!: number;
}
