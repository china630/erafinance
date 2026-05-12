import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EntityCommentKind } from "@erafinance/database";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateEntityCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 16_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(16_000)
  body!: string;

  @ApiPropertyOptional({ enum: EntityCommentKind, description: "AUDIT_NOTE — only for role AUDITOR" })
  @IsOptional()
  @IsEnum(EntityCommentKind)
  kind?: EntityCommentKind;
}
