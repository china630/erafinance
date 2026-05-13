import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { CounterpartyLegalForm } from "@erafinance/database";

export class CreateOrgDto {
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

  @ApiPropertyOptional({ description: "Optional holding to attach the org to" })
  @IsOptional()
  @IsUUID()
  holdingId?: string;

  @ApiPropertyOptional({
    description: "Referral partner code (from /register?ref=)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: "referralCode must be alphanumeric",
  })
  referralCode?: string;
}
