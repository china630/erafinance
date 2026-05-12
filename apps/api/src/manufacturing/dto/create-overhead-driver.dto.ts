import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, MinLength } from "class-validator";
import { OverheadDriverType } from "@erafinance/database";

export class CreateOverheadDriverDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: OverheadDriverType })
  @IsEnum(OverheadDriverType)
  type!: OverheadDriverType;
}
