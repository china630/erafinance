import { Type } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { UserLocale } from "@erafinance/database";

export class PasswordChangeDto {
  @ApiPropertyOptional()
  @IsString()
  currentPassword!: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  /** E.164 +994XXXXXXXXX; empty string clears phone */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ApiPropertyOptional({ enum: UserLocale })
  @IsOptional()
  @IsEnum(UserLocale)
  locale?: UserLocale;

  @ApiPropertyOptional({ type: PasswordChangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PasswordChangeDto)
  passwordChange?: PasswordChangeDto;
}
