import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { AuditEngagementStatus } from "@dayday/database";

export class PatchAuditEngagementStatusDto {
  @ApiProperty({ enum: AuditEngagementStatus })
  @IsEnum(AuditEngagementStatus)
  status!: AuditEngagementStatus;
}
