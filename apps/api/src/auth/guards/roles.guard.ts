import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@erafinance/database";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthUser } from "../types/auth-user";
import type { RequestWithAuditEngagement } from "../../common/request-with-audit-engagement";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }
    const req = context.switchToHttp().getRequest<
      {
        user?: AuthUser;
        method?: string;
        originalUrl?: string;
        url?: string;
      } & RequestWithAuditEngagement
    >();
    const user = req.user;
    if (!user) {
      return false;
    }
    const engOrg = req.auditEngagementEffectiveOrgId;
    const method = (req.method ?? "GET").toUpperCase();
    const url = (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
    if (engOrg) {
      const perms = req.auditEngagementInvitePermissions;
      if (method === "GET" || method === "HEAD") {
        if (url.startsWith("/api/audit-hub") && perms?.auditHubRead !== false) {
          return true;
        }
        if (url.startsWith("/api/activity/") && perms?.auditHubRead !== false) {
          return true;
        }
      }
      if (method === "POST" && url.includes("/api/audit-hub/bulk-export")) {
        return perms?.auditBulkExport === true;
      }
      if (
        method === "POST" &&
        perms?.auditNotesWrite !== false &&
        /\/api\/activity\/[^/]+\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}\/comments$/i.test(
          url,
        )
      ) {
        return true;
      }
      if (
        (method === "PATCH" || method === "DELETE") &&
        perms?.auditNotesWrite !== false &&
        /\/api\/activity\/comments\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(
          url,
        )
      ) {
        return true;
      }
    }
    if (user.role == null) {
      return false;
    }
    return roles.includes(user.role);
  }
}
