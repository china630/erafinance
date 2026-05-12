import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DualApprovalStatus } from "@erafinance/database";
import type { AuthUser } from "../../auth/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { REQUIRES_DUAL_APPROVAL_PURPOSE_KEY } from "./dual-approval.constants";

@Injectable()
export class DualApprovalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const purpose = this.reflector.getAllAndOverride<string>(REQUIRES_DUAL_APPROVAL_PURPOSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!purpose) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      body?: { dualApprovalRequestId?: string };
    }>();
    const id = req.body?.dualApprovalRequestId;
    if (!id || typeof id !== "string") {
      throw new BadRequestException("dualApprovalRequestId is required");
    }
    const row = await this.prisma.dualApprovalRequest.findUnique({ where: { id } });
    if (!row) {
      throw new ForbiddenException("Dual approval request not found");
    }
    if (row.purpose !== purpose) {
      throw new ForbiddenException("Dual approval purpose mismatch");
    }
    if (row.status !== DualApprovalStatus.APPROVED) {
      throw new ForbiddenException("Dual approval not in APPROVED state");
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException("Dual approval request expired");
    }
    const approvers = new Set(row.approverIds);
    if (approvers.size < 2) {
      throw new ForbiddenException("At least two distinct approvers required");
    }
    return true;
  }
}
