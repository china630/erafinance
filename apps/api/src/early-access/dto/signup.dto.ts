import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EarlyAccessModuleKey } from "@erafinance/database";
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/** Industry slug stored with signup (painted-door context; not Organization.industry). */
export const EARLY_ACCESS_INDUSTRY_SLUGS = [
  "retail",
  "construction",
  "logistics",
  "services",
  "manufacturing",
  "other",
] as const;

export type EarlyAccessIndustrySlug = (typeof EARLY_ACCESS_INDUSTRY_SLUGS)[number];

export class EarlyAccessSignupDto {
  @ApiProperty({ enum: EarlyAccessModuleKey })
  @IsEnum(EarlyAccessModuleKey)
  moduleKey!: EarlyAccessModuleKey;

  @ApiProperty({
    description: "Business industry (self-reported)",
    enum: EARLY_ACCESS_INDUSTRY_SLUGS,
  })
  @IsString()
  @IsIn([...EARLY_ACCESS_INDUSTRY_SLUGS])
  industry!: EarlyAccessIndustrySlug;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  surveyAnswer?: string;
}
