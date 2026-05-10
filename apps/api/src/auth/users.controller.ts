import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthUser } from "./types/auth-user";
import { UpdateMeDto } from "./dto/update-me.dto";

@ApiTags("users")
@ApiBearerAuth("bearer")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Get("me")
  @ApiOperation({ summary: "Current user profile (PII, locale, phone)" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getMeProfile(user.userId);
  }

  @Patch("me")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Update profile, locale, phone, password (with current password check)",
  })
  patchMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user.userId, dto);
  }
}
