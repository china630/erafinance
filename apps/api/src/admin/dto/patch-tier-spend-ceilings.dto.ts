import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class PatchTierSpendCeilingsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  TIER_0!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  TIER_1!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  TIER_2!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  TIER_3!: number;
}
