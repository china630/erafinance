import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class EmployeeSyncItemDto {
  @IsString()
  @MinLength(1)
  employeeId!: string;

  @IsString()
  @IsIn(["SYNCED", "ERROR"])
  status!: "SYNCED" | "ERROR";

  @IsOptional()
  @IsString()
  externalId?: string | null;

  @IsOptional()
  @IsString()
  error?: string | null;
}

const BULK_SYNC_ITEMS_MAX = 500;

export class BulkSyncResultEmployeesDto {
  @IsString()
  @MinLength(1)
  runId!: string;

  @IsArray()
  @ArrayMaxSize(BULK_SYNC_ITEMS_MAX)
  @ValidateNested({ each: true })
  @Type(() => EmployeeSyncItemDto)
  items!: EmployeeSyncItemDto[];
}
