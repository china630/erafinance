import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  EarlyAccessEventType,
  EarlyAccessModuleKey,
} from "@erafinance/database";
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class RecordEarlyAccessEventDto {
  @ApiProperty({ enum: EarlyAccessModuleKey })
  @IsEnum(EarlyAccessModuleKey)
  moduleKey!: EarlyAccessModuleKey;

  @ApiProperty({ enum: EarlyAccessEventType })
  @IsEnum(EarlyAccessEventType)
  eventType!: EarlyAccessEventType;

  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  sessionId!: string;

  @ApiPropertyOptional({ description: "Required for MODAL_CLOSE" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  durationMs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
