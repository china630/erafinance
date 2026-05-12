import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { TimeEntryStatus } from "@erafinance/database";

export class PatchPsaTimeEntryDto {
  @ApiPropertyOptional({ enum: TimeEntryStatus })
  @IsOptional()
  @IsEnum(TimeEntryStatus)
  status?: TimeEntryStatus;
}
