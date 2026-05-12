/**
 * Writes hash-chain AuditLog rows on the **client (audited) organization** when an
 * external auditor session is active, for mutating HTTP methods only (avoids GET noise).
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import type { AuthUser } from "../auth/types/auth-user";
import { AuditService } from "../audit/audit.service";
import type { RequestWithAuditEngagement } from "../common/request-with-audit-engagement";

const SKIP = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class AuditEngagementGuestAccessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditEngagementGuestAccessLogInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<
      Request &
        RequestWithAuditEngagement & {
          user?: AuthUser;
        }
    >();
    const orgId = req.auditEngagementEffectiveOrgId;
    const inviteId = req.auditEngagementInviteId;
    const userId = req.user?.userId;
    const method = (req.method ?? "GET").toUpperCase();
    const path = (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";

    if (!orgId || !inviteId || !userId || SKIP.has(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      finalize(() => {
        void this.audit
          .appendTenantAuditChainEntry({
            organizationId: orgId,
            userId,
            entityType: "audit_hub.external_engagement",
            entityId: inviteId,
            action: `guest_${method}`,
            newValues: {
              inviteId,
              path: path.slice(0, 500),
              method,
            },
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`guest engagement audit log failed: ${msg}`);
          });
      }),
    );
  }
}
