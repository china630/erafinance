import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

export class VerifyStepUpOtpDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  purpose!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
