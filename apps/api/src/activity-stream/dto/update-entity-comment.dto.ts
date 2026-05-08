import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateEntityCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 16_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(16_000)
  body!: string;
}
