import { ArrayMaxSize, IsArray, IsString, MinLength } from "class-validator";

const BULK_IDS_MAX = 500;

export class BulkPrefillEmployeesDto {
  @IsArray()
  @ArrayMaxSize(BULK_IDS_MAX)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  employeeIds!: string[];
}
