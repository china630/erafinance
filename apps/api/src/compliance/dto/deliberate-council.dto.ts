import { IsIn, IsOptional, IsUUID } from "class-validator";
import { COUNCIL_TARGET_ENTITY_TYPES } from "../council/council.types";

export class DeliberateCouncilDto {
  @IsOptional()
  @IsUUID()
  riskAuditId?: string;

  @IsOptional()
  @IsIn([...COUNCIL_TARGET_ENTITY_TYPES])
  targetEntityType?: (typeof COUNCIL_TARGET_ENTITY_TYPES)[number];

  @IsOptional()
  @IsUUID()
  targetEntityId?: string;
}
