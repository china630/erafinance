import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { OverheadDriverType } from "@erafinance/database";

export class UpdateOverheadDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: OverheadDriverType })
  @IsOptional()
  @IsEnum(OverheadDriverType)
  type?: OverheadDriverType;
}
