import { ApiProperty } from "@nestjs/swagger";
import { IsDateString } from "class-validator";

export class GeneratePsaInvoiceDto {
  @ApiProperty({ example: "2026-05-01" })
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ example: "2026-05-31" })
  @IsDateString()
  dateTo!: string;
}
