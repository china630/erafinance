import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../auth/constants";
import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../prisma/prisma.service";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class SubscriptionReadOnlyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      path?: string;
      url?: string;
      user?: AuthUser;
    } & import("../common/request-with-audit-engagement").RequestWithAuditEngagement>();
    const method = (req.method ?? "GET").toUpperCase();
    const path = this.normalizePath(
      req.originalUrl?.split("?")[0] ??
        req.path ??
        req.url?.split("?")[0] ??
        "",
    );
    const user = req.user;
    const orgForBlock =
      req.auditEngagementEffectiveOrgId ?? user?.organizationId;
    if (!orgForBlock || user?.isSuperAdmin) return true;
    if (READ_METHODS.has(method) || this.isWhitelistedPath(path)) return true;

    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: orgForBlock },
      select: { isBlocked: true },
    });
    if (!sub?.isBlocked) return true;

    throw new ForbiddenException({
      statusCode: 403,
      code: "SUBSCRIPTION_SUSPENDED_READ_ONLY",
      message:
        "Subscription is suspended by administrator; write actions are disabled.",
    });
  }

  private normalizePath(path: string): string {
    if (!path) return "";
    if (path.startsWith("/api")) return path;
    return path.startsWith("/") ? `/api${path}` : `/api/${path}`;
  }

  private isWhitelistedPath(path: string): boolean {
    return (
      path.startsWith("/api/auth") ||
      path.startsWith("/api/public") ||
      path === "/api/billing/checkout" ||
      path.startsWith("/api/billing/webhooks/") ||
      path.startsWith("/api/early-access/") ||
      path.startsWith("/api/audit-hub/me/")
    );
  }
}
