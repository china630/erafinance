import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class AcceptAuditInviteDto {
  @ApiProperty({ description: "Plaintext invite token (single-use knowledge factor)" })
  @IsString()
  @MinLength(16)
  token!: string;
}
