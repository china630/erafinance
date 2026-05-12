import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { actorContextStorage } from "../common/actor-context";
import type { RequestWithAuditEngagement } from "../common/request-with-audit-engagement";
import { tenantContextStorage } from "./tenant-context";

/**
 * Заполняет AsyncLocalStorage для Prisma tenant extension.
 * Порядок Nest: Guards → Interceptors → handler — JWT уже установил req.user.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      user?: {
        userId?: string;
        organizationId?: string;
        isSuperAdmin?: boolean;
      };
      originalUrl?: string;
      url?: string;
    } & RequestWithAuditEngagement>();
    const url = (req.originalUrl ?? req.url ?? "").split("?")[0];
    const user = req.user;

    const isPublic =
      url.startsWith("/api/public") ||
      url.startsWith("/api/auth/login") ||
      url.startsWith("/api/auth/register-user") ||
      url.startsWith("/api/auth/register") ||
      url.startsWith("/api/auth/refresh") ||
      url === "/api/health" ||
      url.startsWith("/docs");

    const runWithContexts = (tenantStore: {
      organizationId: string | null;
      skipTenantFilter: boolean;
    }) =>
      tenantContextStorage.run(tenantStore, () =>
        actorContextStorage.run({ userId: user?.userId ?? null }, () => next.handle()),
      );

    if (isPublic) {
      return runWithContexts({ organizationId: null, skipTenantFilter: true });
    }

    if (!user) {
      return runWithContexts({ organizationId: null, skipTenantFilter: true });
    }

    const effectiveOrgId =
      req.auditEngagementEffectiveOrgId ?? user.organizationId ?? null;

    /** TZ §15 / PRD §7.6: маршруты `/api/admin/*` — супер-админ видит всю систему (Prisma без merge по organizationId). */
    const skipTenantFilter =
      Boolean(user.isSuperAdmin) && url.startsWith("/api/admin");

    return runWithContexts({
      organizationId: effectiveOrgId,
      skipTenantFilter,
    });
  }
}
