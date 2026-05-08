import { ArrayMaxSize, IsArray, IsString, MinLength } from "class-validator";

/** Stage A: cap bulk payload size (extension / API). */
const BULK_IDS_MAX = 500;

export class BulkPrefillInvoicesDto {
  @IsArray()
  @ArrayMaxSize(BULK_IDS_MAX)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  invoiceIds!: string[];
}
