import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIBAN, IsOptional, IsString } from "class-validator";

export class SendAllPendingPaymentDraftsDto {
  @ApiPropertyOptional({
    description:
      "IBAN счёта списания; если не указан — первый IBAN из organization_bank_accounts организации",
  })
  @IsOptional()
  @IsString()
  @IsIBAN()
  fromAccountIban?: string;
}
