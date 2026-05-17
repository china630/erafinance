import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  RiskAuditStatus,
  RiskAuditType,
  RiskSeverity,
} from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";
import { decodeOrganizationTaxId } from "../../security/pii-crypto.util";
import { validateVoen } from "../../common/utils/voen-validator";
import type { AuthUser } from "../types/auth-user";
import type { RequestWithAuditEngagement } from "../../common/request-with-audit-engagement";

/** User-facing copy (API JSON); web may still use i18n keys for toasts. */
export const VOEN_INTEGRITY_MESSAGE_AZ =
  "VÖEN düzgün deyil və ya sistemdə artıq mövcuddur";
export const VOEN_INTEGRITY_MESSAGE_RU =
  "VÖEN неверный или уже существует в системе";

function resolvePreferredMessage(req: Request): {
  message: string;
  messageAz: string;
  messageRu: string;
} {
  const al = String(req.headers["accept-language"] ?? "").toLowerCase();
  const preferRu = al.includes("ru");
  return {
    message: preferRu ? VOEN_INTEGRITY_MESSAGE_RU : VOEN_INTEGRITY_MESSAGE_AZ,
    messageAz: VOEN_INTEGRITY_MESSAGE_AZ,
    messageRu: VOEN_INTEGRITY_MESSAGE_RU,
  };
}

/**
 * Premium / B2G entrypoints: persisted blind index, decryptable VÖEN must pass AZ rules,
 * and the org must not have an open high-severity fraud/compliance RiskAudit (ERM).
 */
@Injectable()
export class VoenIntegrityGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: AuthUser } & RequestWithAuditEngagement
    >();
    const orgId =
      req.auditEngagementEffectiveOrgId ?? req.user?.organizationId;
    if (!orgId) {
      throw new UnauthorizedException();
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, isDeleted: false },
      select: { taxIdBlindIndex: true, taxIdCipher: true },
    });

    const { message, messageAz, messageRu } = resolvePreferredMessage(req);

    if (!org?.taxIdBlindIndex) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "VOEN_INTEGRITY_BLOCKED",
        message,
        messageAz,
        messageRu,
      });
    }

    const plaintext = decodeOrganizationTaxId(org);
    const { ok } = validateVoen(plaintext);
    if (!ok) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "VOEN_INTEGRITY_BLOCKED",
        message,
        messageAz,
        messageRu,
      });
    }

    const riskyCount = await this.prisma.riskAudit.count({
      where: {
        organizationId: orgId,
        status: RiskAuditStatus.PENDING,
        severity: RiskSeverity.HIGH,
        type: { in: [RiskAuditType.FRAUD, RiskAuditType.COMPLIANCE] },
      },
    });
    if (riskyCount > 0) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "VOEN_INTEGRITY_BLOCKED",
        message,
        messageAz,
        messageRu,
      });
    }

    return true;
  }
}
