import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalDocumentType,
  ApprovalRequestStatus,
  ApprovalStepDecision,
  CashOrderStatus,
  Decimal,
  NotificationSeverity,
  UserRole,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notifications/notification.service";

function d(v: Decimal | string | null | undefined): Decimal {
  if (v == null) return new Decimal(0);
  return new Decimal(v);
}

function policyMatchesAmount(
  amountFrom: Decimal | null,
  amountTo: Decimal | null,
  amount: Decimal,
): boolean {
  if (amountFrom != null && amount.lt(amountFrom)) {
    return false;
  }
  if (amountTo != null && amount.gt(amountTo)) {
    return false;
  }
  return true;
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private pickPolicy<T extends { amountFrom: Decimal | null; amountTo: Decimal | null }>(
    matches: T[],
  ): T | null {
    if (!matches.length) {
      return null;
    }
    return [...matches].sort((a, b) => {
      const af = d(a.amountFrom);
      const bf = d(b.amountFrom);
      return bf.cmp(af);
    })[0]!;
  }

  async assertCashOrderMayPost(organizationId: string, orderId: string): Promise<void> {
    const order = await this.prisma.cashOrder.findFirst({
      where: { id: orderId, organizationId },
    });
    if (!order) {
      throw new NotFoundException("Cash order not found");
    }
    const amount = d(order.amount);
    const policies = await this.prisma.approvalPolicy.findMany({
      where: {
        organizationId,
        documentType: ApprovalDocumentType.CASH_ORDER,
        isActive: true,
        currency: order.currency,
      },
    });
    const matches = policies.filter((p) =>
      policyMatchesAmount(
        p.amountFrom != null ? d(p.amountFrom) : null,
        p.amountTo != null ? d(p.amountTo) : null,
        amount,
      ),
    );
    const chosen = this.pickPolicy(matches);
    if (!chosen) {
      return;
    }
    const approved = await this.prisma.approvalRequest.findFirst({
      where: {
        organizationId,
        documentType: ApprovalDocumentType.CASH_ORDER,
        entityId: orderId,
        status: ApprovalRequestStatus.APPROVED,
      },
    });
    if (approved) {
      return;
    }
    const pending = await this.prisma.approvalRequest.findFirst({
      where: {
        organizationId,
        documentType: ApprovalDocumentType.CASH_ORDER,
        entityId: orderId,
        status: ApprovalRequestStatus.PENDING,
      },
    });
    if (pending) {
      throw new ForbiddenException({
        code: "APPROVAL_PENDING",
        message: "Cash order is pending approval.",
      });
    }
    throw new ForbiddenException({
      code: "APPROVAL_REQUIRED",
      message: "Submit this cash order for approval before posting.",
    });
  }

  private async notifyApproversForStep(params: {
    organizationId: string;
    requestId: string;
    role: UserRole;
    title: string;
    message: string;
  }): Promise<void> {
    const members = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId: params.organizationId,
        deletedAt: null,
        role: params.role,
      },
      select: { userId: true },
    });
    const link = `/inbox/approvals?request=${encodeURIComponent(params.requestId)}`;
    for (const m of members) {
      await this.notifications.createNotification({
        organizationId: params.organizationId,
        userId: m.userId,
        title: params.title,
        message: params.message,
        severity: NotificationSeverity.INFO,
        link,
      });
    }
  }

  async submitCashOrder(params: {
    organizationId: string;
    userId: string;
    cashOrderId: string;
  }): Promise<{ requestId: string } | { skipped: true }> {
    const order = await this.prisma.cashOrder.findFirst({
      where: { id: params.cashOrderId, organizationId: params.organizationId },
    });
    if (!order) {
      throw new NotFoundException("Cash order not found");
    }
    if (order.status !== CashOrderStatus.DRAFT) {
      throw new ConflictException("Only draft cash orders can be submitted for approval");
    }
    const amount = d(order.amount);
    const policies = await this.prisma.approvalPolicy.findMany({
      where: {
        organizationId: params.organizationId,
        documentType: ApprovalDocumentType.CASH_ORDER,
        isActive: true,
        currency: order.currency,
      },
    });
    const matches = policies.filter((p) =>
      policyMatchesAmount(
        p.amountFrom != null ? d(p.amountFrom) : null,
        p.amountTo != null ? d(p.amountTo) : null,
        amount,
      ),
    );
    const chosen = this.pickPolicy(matches);
    if (!chosen || chosen.approverRoles.length === 0) {
      return { skipped: true };
    }

    const pending = await this.prisma.approvalRequest.findFirst({
      where: {
        organizationId: params.organizationId,
        documentType: ApprovalDocumentType.CASH_ORDER,
        entityId: params.cashOrderId,
        status: ApprovalRequestStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException("Approval request already pending");
    }

    const req = await this.prisma.$transaction(async (tx) => {
      const r = await tx.approvalRequest.create({
        data: {
          organizationId: params.organizationId,
          documentType: ApprovalDocumentType.CASH_ORDER,
          entityId: params.cashOrderId,
          status: ApprovalRequestStatus.PENDING,
          requestedByUserId: params.userId,
          currentStepNo: 1,
          totalSteps: chosen.approverRoles.length,
        },
      });
      let stepNo = 1;
      for (const role of chosen.approverRoles) {
        await tx.approvalStep.create({
          data: {
            requestId: r.id,
            stepNo,
            assignedRole: role,
          },
        });
        stepNo += 1;
      }
      return r;
    });

    const firstRole = chosen.approverRoles[0]!;
    await this.notifyApproversForStep({
      organizationId: params.organizationId,
      requestId: req.id,
      role: firstRole,
      title: "Approval required",
      message: `Cash order ${order.orderNumber} awaits your approval (step 1/${chosen.approverRoles.length}).`,
    });

    return { requestId: req.id };
  }

  async inboxForUser(organizationId: string, userId: string): Promise<
    Array<{
      id: string;
      documentType: ApprovalDocumentType;
      entityId: string;
      status: ApprovalRequestStatus;
      currentStepNo: number;
      totalSteps: number;
      createdAt: Date;
    }>
  > {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { organizationId, userId, deletedAt: null },
    });
    if (!membership) {
      return [];
    }
    const role = membership.role;
    const pending = await this.prisma.approvalRequest.findMany({
      where: { organizationId, status: ApprovalRequestStatus.PENDING },
      include: { steps: true },
      orderBy: [{ createdAt: "desc" }],
    });
    return pending
      .filter((r) => {
        const step = r.steps.find((s) => s.stepNo === r.currentStepNo);
        return step && step.decision == null && step.assignedRole === role;
      })
      .map((r) => ({
        id: r.id,
        documentType: r.documentType,
        entityId: r.entityId,
        status: r.status,
        currentStepNo: r.currentStepNo,
        totalSteps: r.totalSteps,
        createdAt: r.createdAt,
      }));
  }

  private async assertMembershipRole(
    organizationId: string,
    userId: string,
    expected: UserRole,
  ): Promise<void> {
    const m = await this.prisma.organizationMembership.findFirst({
      where: { organizationId, userId, deletedAt: null },
    });
    if (!m || m.role !== expected) {
      throw new ForbiddenException({
        code: "APPROVAL_ROLE_MISMATCH",
        message: "Your role cannot decide this approval step.",
      });
    }
  }

  async approveStep(params: {
    organizationId: string;
    userId: string;
    requestId: string;
    stepNo: number;
  }): Promise<void> {
    const req = await this.prisma.approvalRequest.findFirst({
      where: { id: params.requestId, organizationId: params.organizationId },
      include: { steps: true },
    });
    if (!req) {
      throw new NotFoundException();
    }
    if (req.status !== ApprovalRequestStatus.PENDING) {
      throw new ConflictException("Request is not pending");
    }
    if (req.currentStepNo !== params.stepNo) {
      throw new ConflictException("Not the current approval step");
    }
    const step = req.steps.find((s) => s.stepNo === params.stepNo);
    if (!step || step.decision != null) {
      throw new ConflictException("Step already decided");
    }
    await this.assertMembershipRole(params.organizationId, params.userId, step.assignedRole);

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          decision: ApprovalStepDecision.APPROVED,
          approverUserId: params.userId,
          decidedAt: new Date(),
        },
      });
      if (params.stepNo >= req.totalSteps) {
        await tx.approvalRequest.update({
          where: { id: req.id },
          data: {
            status: ApprovalRequestStatus.APPROVED,
            finalDecisionAt: new Date(),
          },
        });
      } else {
        const nextStepNo = params.stepNo + 1;
        await tx.approvalRequest.update({
          where: { id: req.id },
          data: { currentStepNo: nextStepNo },
        });
        const next = req.steps.find((s) => s.stepNo === nextStepNo);
        if (next) {
          // notify outside tx
        }
      }
    });

    if (params.stepNo < req.totalSteps) {
      const nextStepNo = params.stepNo + 1;
      const next = req.steps.find((s) => s.stepNo === nextStepNo);
      if (next) {
        await this.notifyApproversForStep({
          organizationId: params.organizationId,
          requestId: req.id,
          role: next.assignedRole,
          title: "Approval required",
          message: `Multi-step approval: step ${nextStepNo}/${req.totalSteps}.`,
        });
      }
    }
  }

  async rejectStep(params: {
    organizationId: string;
    userId: string;
    requestId: string;
    stepNo: number;
    comment: string;
  }): Promise<void> {
    const trimmed = params.comment?.trim() ?? "";
    if (!trimmed) {
      throw new BadRequestException({
        code: "APPROVAL_REJECT_COMMENT_REQUIRED",
        message: "Reject requires a non-empty comment.",
      });
    }
    const req = await this.prisma.approvalRequest.findFirst({
      where: { id: params.requestId, organizationId: params.organizationId },
      include: { steps: true },
    });
    if (!req) {
      throw new NotFoundException();
    }
    if (req.status !== ApprovalRequestStatus.PENDING) {
      throw new ConflictException("Request is not pending");
    }
    if (req.currentStepNo !== params.stepNo) {
      throw new ConflictException("Not the current approval step");
    }
    const step = req.steps.find((s) => s.stepNo === params.stepNo);
    if (!step || step.decision != null) {
      throw new ConflictException("Step already decided");
    }
    await this.assertMembershipRole(params.organizationId, params.userId, step.assignedRole);

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          decision: ApprovalStepDecision.REJECTED,
          comment: trimmed,
          approverUserId: params.userId,
          decidedAt: new Date(),
        },
      });
      await tx.approvalRequest.update({
        where: { id: req.id },
        data: {
          status: ApprovalRequestStatus.REJECTED,
          finalDecisionAt: new Date(),
        },
      });
    });
  }
}
