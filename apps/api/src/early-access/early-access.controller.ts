import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganizationId } from "../common/org-id.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { EarlyAccessService } from "./early-access.service";
import { RecordEarlyAccessEventDto } from "./dto/record-event.dto";
import { EarlyAccessSignupDto } from "./dto/signup.dto";

@ApiTags("early-access")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("early-access")
export class EarlyAccessController {
  constructor(private readonly earlyAccess: EarlyAccessService) {}

  @Post("events")
  @ApiOperation({ summary: "Record painted-door funnel event (high volume; not audit-logged)" })
  async recordEvent(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecordEarlyAccessEventDto,
    @Req() req: Request,
  ) {
    return this.earlyAccess.recordEvent(user, dto, req);
  }

  @Post("signup")
  @ApiOperation({ summary: "Join early access waitlist (idempotent per org + module)" })
  async signup(
    @CurrentUser() user: AuthUser,
    @Body() dto: EarlyAccessSignupDto,
    @Req() req: Request,
  ) {
    return this.earlyAccess.signup(user, dto, req);
  }

  @Get("me")
  @ApiOperation({ summary: "Current org waitlist rows" })
  async me(@OrganizationId() organizationId: string) {
    return this.earlyAccess.listMine(organizationId);
  }
}
