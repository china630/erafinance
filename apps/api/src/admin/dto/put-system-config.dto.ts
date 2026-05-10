import { ApiProperty } from "@nestjs/swagger";
import { Allow } from "class-validator";

export class PutSystemConfigDto {
  @ApiProperty({
    description: "JSON value (validated per key by server)",
    type: "object",
    additionalProperties: true,
  })
  @Allow()
  value!: unknown;
}
