import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsUUID } from "class-validator";

export class ToggleBundleDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  bundleId!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
