import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RequestStepUpOtpDto {
  @ApiProperty({ example: "ownership_transfer" })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  purpose!: string;
}
