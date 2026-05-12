import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { DualApprovalStatus } from "@erafinance/database";
import { MailService } from "../../mail/mail.service";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_EXPIRY_HOURS = 72;

@Injectable()
export class DualApprovalService {
  private readonly logger = new Logger(DualApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async createRequest(
    requesterId: string,
    purpose: string,
    payload: object,
    expiresAt: Date,
  ) {
    return this.prisma.dualApprovalRequest.create({
      data: {
        requesterId,
        purpose,
        payload,
        expiresAt,
        status: DualApprovalStatus.PENDING,
      },
    });
  }

  /** Convenience: default expiry + email other super-admins. */
  async createRequestWithExpiry(
    requesterId: string,
    purpose: string,
    payload: Record<string, unknown>,
    expiryHours: number = DEFAULT_EXPIRY_HOURS,
  ) {
    const expiresAt = new Date();
    expiresAt.setUTCHours(expiresAt.getUTCHours() + expiryHours);
    const row = await this.createRequest(requesterId, purpose, payload, expiresAt);
    await this.notifySuperAdminsOfNewRequest(row.id, purpose, requesterId).catch((e) =>
      this.logger.warn(`notifySuperAdminsOfNewRequest: ${e instanceof Error ? e.message : String(e)}`),
    );
    return row;
  }

  private async notifySuperAdminsOfNewRequest(
    requestId: string,
    purpose: string,
    requesterId: string,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { isSuperAdmin: true, id: { not: requesterId } },
      select: { email: true },
    });
    const subject = `ERA Finance — dual approval required (${purpose})`;
    const text = `A dual-approval request was created.\nRequest ID: ${requestId}\nPurpose: ${purpose}\nApprove via POST /api/admin/platform/dual-approval/${requestId}/approve`;
    for (const a of admins) {
      if (!a.email) continue;
      await this.mail.sendMail({ to: a.email, subject, text });
    }
  }

  async approve(id: string, approverId: string): Promise<{ id: string; status: DualApprovalStatus }> {
    const row = await this.prisma.dualApprovalRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException("Dual approval request not found");
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await this.prisma.dualApprovalRequest.update({
        where: { id },
        data: { status: DualApprovalStatus.EXPIRED },
      });
      throw new ForbiddenException("Request expired");
    }
    if (row.status !== DualApprovalStatus.PENDING) {
      throw new ForbiddenException("Request is not pending");
    }
    if (row.requesterId === approverId) {
      throw new ForbiddenException("Requester cannot approve own request");
    }
    const approvers = new Set(row.approverIds);
    approvers.add(approverId);
    const approverIds = [...approvers];
    const status =
      approverIds.length >= 2 ? DualApprovalStatus.APPROVED : DualApprovalStatus.PENDING;
    const updated = await this.prisma.dualApprovalRequest.update({
      where: { id },
      data: { approverIds, status },
    });
    return { id: updated.id, status: updated.status };
  }

  async markApprovedIfTwoApprovers(id: string): Promise<void> {
    const row = await this.prisma.dualApprovalRequest.findUnique({ where: { id } });
    if (!row || row.status !== DualApprovalStatus.PENDING) {
      return;
    }
    const distinct = new Set(row.approverIds);
    if (distinct.size < 2) {
      throw new ForbiddenException("At least two distinct approvers required");
    }
    await this.prisma.dualApprovalRequest.update({
      where: { id },
      data: { status: DualApprovalStatus.APPROVED },
    });
  }

  async executeIfApproved<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const row = await this.prisma.dualApprovalRequest.findUnique({ where: { id } });
    if (!row) {
      throw new ForbiddenException("Dual approval request not found");
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await this.prisma.dualApprovalRequest.update({
        where: { id },
        data: { status: DualApprovalStatus.EXPIRED },
      });
      throw new ForbiddenException("Dual approval request expired");
    }
    if (row.status !== DualApprovalStatus.APPROVED) {
      throw new ForbiddenException("Dual approval not in APPROVED state");
    }
    const distinct = new Set(row.approverIds);
    if (distinct.size < 2) {
      throw new ForbiddenException("At least two distinct approvers required");
    }
    const out = await fn();
    await this.prisma.dualApprovalRequest.update({
      where: { id },
      data: { status: DualApprovalStatus.EXECUTED, executedAt: new Date() },
    });
    return out;
  }
}
