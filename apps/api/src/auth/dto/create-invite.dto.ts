import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { IsEmail, IsEnum } from "class-validator";

export class CreateInviteDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}
