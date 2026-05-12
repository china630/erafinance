import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class CreateAuditEngagementInviteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inviteeUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  inviteeEmail?: string;

  @ApiPropertyOptional({ default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;

  @ApiPropertyOptional({
    description: "Optional permission overrides",
  })
  @IsOptional()
  @IsObject()
  permissions?: {
    auditHubRead?: boolean;
    auditNotesWrite?: boolean;
    auditBulkExport?: boolean;
  };
}
