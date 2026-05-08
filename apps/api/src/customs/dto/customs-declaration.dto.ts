import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class UpsertCustomsDeclarationDto {
  @ApiProperty() @IsString() bgdNumber!: string;
  @ApiProperty() @IsDateString() bgdDate!: string;
  @ApiProperty() @IsString() currency!: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) customsValueAzn!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) customsDutyAzn!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) customsVatAzn!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) feesAzn!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class AttachCustomsDeclarationDto {
  @ApiProperty() @IsUUID() purchaseTransactionId!: string;
}
