import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthUser } from "../../auth/types/auth-user";
import type { RequestWithAuditEngagement } from "../request-with-audit-engagement";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Premium RPA / tax flows require a persisted VÖEN blind index (1 org = 1 VÖEN, TZ §2).
 */
@Injectable()
export class VoenIntegrityGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      { user?: AuthUser } & RequestWithAuditEngagement
    >();
    const orgId =
      req.auditEngagementEffectiveOrgId ?? req.user?.organizationId;
    if (!orgId) {
      throw new UnauthorizedException();
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, isDeleted: false },
      select: { taxIdBlindIndex: true },
    });
    if (!org?.taxIdBlindIndex) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "VOEN_INTEGRITY_REQUIRED",
        message:
          "Organization VÖEN is not available for this operation; contact support.",
      });
    }
    return true;
  }
}
