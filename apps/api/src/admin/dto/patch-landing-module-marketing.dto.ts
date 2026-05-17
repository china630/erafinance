import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

class LocaleStringDto {
  @IsString()
  az!: string;

  @IsString()
  ru!: string;
}

class LocaleStringArrayDto {
  @IsArray()
  @IsString({ each: true })
  az!: string[];

  @IsArray()
  @IsString({ each: true })
  ru!: string[];
}

export class PatchLandingModuleMarketingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ValidateNested()
  @Type(() => LocaleStringDto)
  names!: LocaleStringDto;

  @ValidateNested()
  @Type(() => LocaleStringDto)
  descriptions!: LocaleStringDto;

  @ValidateNested()
  @Type(() => LocaleStringArrayDto)
  tasks!: LocaleStringArrayDto;
}
