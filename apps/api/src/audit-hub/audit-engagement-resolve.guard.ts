import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import type { RequestWithAuditEngagement } from "../common/request-with-audit-engagement";
import { AuditEngagementInviteService } from "./audit-engagement-invite.service";

const INVITE_ID = "x-audit-engagement-invite-id";
const TOKEN = "x-audit-engagement-token";

@Injectable()
export class AuditEngagementResolveGuard implements CanActivate {
  constructor(private readonly invites: AuditEngagementInviteService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & RequestWithAuditEngagement
    >();
    const user = req.user;
    if (!user?.userId || !user.email) {
      return true;
    }
    const inviteId = (req.get(INVITE_ID) ?? "").trim();
    const token = (req.get(TOKEN) ?? "").trim();
    if (!inviteId || !token) {
      return true;
    }
    const resolved = await this.invites.resolveActiveEngagement(
      user.userId,
      user.email,
      inviteId,
      token,
    );
    if (!resolved) {
      throw new ForbiddenException({
        code: "AUDIT_ENGAGEMENT_INVALID",
        message: "Invalid or expired audit engagement headers.",
      });
    }
    req.auditEngagementEffectiveOrgId = resolved.targetOrganizationId;
    req.auditEngagementInviteId = resolved.inviteId;
    req.auditEngagementInvitePermissions = resolved.permissions;
    req.auditEngagementClientOrgName = resolved.organizationName;
    return true;
  }
}
