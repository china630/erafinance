import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsString, MaxLength, MinLength } from "class-validator";

export class CreateDualApprovalDto {
  @ApiProperty({ example: "ownership_transfer" })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  purpose!: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  payload!: Record<string, unknown>;
}
