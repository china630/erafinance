import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateAdminPartnerDto {
  @ApiProperty({ example: "TiVi Media" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCorporate?: boolean;

  @ApiPropertyOptional({ description: "Fixed commission % (corporate override)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fixedRatePercent?: number | null;

  @ApiPropertyOptional({ description: "User who can open /partner dashboard" })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactPhone?: string | null;
}

export class PatchAdminPartnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCorporate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fixedRatePercent?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactPhone?: string | null;
}
