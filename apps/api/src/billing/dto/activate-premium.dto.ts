import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsBoolean, IsString } from "class-validator";

export class ActivatePremiumDto {
  @ApiProperty({
    description: "Premium module slugs to unlock (must have is_premium in pricing_modules)",
    example: ["tax_pro"],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  modules!: string[];

  @ApiProperty({
    description:
      "Client confirms transition to paid commercial tracking (card verification stub in v1)",
    example: true,
  })
  @IsBoolean()
  confirmCommercialStatus!: boolean;
}
