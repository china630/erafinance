import { IsNumber, IsOptional, IsPositive, IsUUID } from "class-validator";

export class CreateManufacturingOrderDto {
  @IsUUID()
  recipeId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
