import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { CounterpartyLegalForm } from "@erafinance/database";

export class RegisterOrgDto {
  @ApiProperty({ example: "ООО Пример" })
  @IsString()
  @MaxLength(255)
  organizationName!: string;

  @ApiProperty({ description: "VÖEN — 10 цифр", example: "1234567890" })
  @IsString()
  @Matches(/^\d{10}$/, { message: "taxId must be 10 digits (VÖEN)" })
  taxId!: string;

  @ApiPropertyOptional({ default: "AZN" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({
    enum: CounterpartyLegalForm,
    description:
      "Legal form of the organization; NAS kind is derived on server (STATE_AGENCY->BUDGET, NGO->NGO, else COMMERCIAL).",
  })
  @IsEnum(CounterpartyLegalForm)
  legalForm!: CounterpartyLegalForm;

  @ApiProperty({ example: "owner@company.com" })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: "Иван" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  adminFirstName!: string;

  @ApiProperty({ example: "Иванов" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  adminLastName!: string;

  @ApiProperty({ minLength: 8, example: "SecretPass1" })
  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @ApiPropertyOptional({
    description: "Referral partner code (from /register?ref=)",
    example: "A1B2C3D4",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: "referralCode must be alphanumeric",
  })
  referralCode?: string;
}
