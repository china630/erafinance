import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { AuditEngagementInviteService } from "./audit-engagement-invite.service";
import type { Request } from "express";
import type { RequestWithAuditEngagement } from "../common/request-with-audit-engagement";
import { AcceptAuditInviteDto } from "./dto/accept-audit-invite.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("audit-hub")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("audit-hub/me")
export class AuditHubMeController {
  constructor(private readonly invites: AuditEngagementInviteService) {}

  @Get("audit-invites/inbox")
  @ApiOperation({ summary: "Invites addressed to the current user (no org module gate)" })
  inbox(@CurrentUser() user: AuthUser) {
    return this.invites.listInboxForUser(user.userId, user.email);
  }

  @Get("audit-engagement/context")
  @ApiOperation({
    summary:
      "When x-audit-engagement-invite-id and x-audit-engagement-token headers are set, returns active client org context",
  })
  engagementContext(
    @Req() req: Request & RequestWithAuditEngagement,
  ) {
    if (!req.auditEngagementEffectiveOrgId) {
      return { active: false as const };
    }
    return {
      active: true as const,
      organizationId: req.auditEngagementEffectiveOrgId,
      organizationName: req.auditEngagementClientOrgName ?? "",
      permissions: req.auditEngagementInvitePermissions ?? {},
    };
  }

  @Post("audit-invites/:id/accept")
  @ApiOperation({ summary: "Accept an external auditor invite (token from issuer)" })
  accept(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AcceptAuditInviteDto,
  ) {
    return this.invites.acceptInvite(user.userId, user.email, id, dto.token);
  }

  @Post("audit-invites/:id/decline")
  @ApiOperation({ summary: "Decline a pending external auditor invite (same token as accept)" })
  decline(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AcceptAuditInviteDto,
  ) {
    return this.invites.declineInvite(user.userId, user.email, id, dto.token);
  }
}
