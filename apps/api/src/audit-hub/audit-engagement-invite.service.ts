import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditEngagementInviteStatus,
  UserRole,
} from "@erafinance/database";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import type { AuditEngagementInvitePermissions } from "../common/request-with-audit-engagement";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function parsePermissions(raw: unknown): AuditEngagementInvitePermissions {
  if (!raw || typeof raw !== "object") {
    return {
      auditHubRead: true,
      auditNotesWrite: true,
      auditBulkExport: false,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    auditHubRead: o.auditHubRead !== false,
    auditNotesWrite: o.auditNotesWrite !== false,
    auditBulkExport: o.auditBulkExport === true,
  };
}

export type CreateAuditEngagementInviteInput = {
  inviteeUserId?: string;
  inviteeEmail?: string;
  expiresInDays?: number;
  permissions?: AuditEngagementInvitePermissions;
};

@Injectable()
export class AuditEngagementInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async createInvite(
    targetOrganizationId: string,
    inviterUserId: string,
    input: CreateAuditEngagementInviteInput,
  ) {
    const inviter = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId: targetOrganizationId,
        userId: inviterUserId,
        deletedAt: null,
        role: { in: [UserRole.OWNER, UserRole.ADMIN] },
      },
      select: { userId: true },
    });
    if (!inviter) {
      throw new ForbiddenException({
        code: "AUDIT_INVITE_NOT_OWNER_ADMIN",
        message: "Only OWNER or ADMIN may create external auditor invites.",
      });
    }
    const has = await this.subscriptionAccess.hasModule(
      targetOrganizationId,
      ModuleEntitlement.AUDIT_HUB,
    );
    if (!has) {
      throw new ForbiddenException({
        code: "AUDIT_HUB_REQUIRED",
        message: "Audit Hub must be active on the organization to invite an external auditor.",
      });
    }
    if (!input.inviteeEmail?.trim() && !input.inviteeUserId) {
      throw new BadRequestException({
        code: "AUDIT_INVITE_RECIPIENT_REQUIRED",
        message: "Provide inviteeEmail or inviteeUserId.",
      });
    }
    const expiresInDays = Math.min(
      90,
      Math.max(1, input.expiresInDays ?? 14),
    );
    const expiresAt = new Date(
      Date.now() + expiresInDays * 86_400_000,
    );
    const token = randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const permissions = {
      auditHubRead: input.permissions?.auditHubRead !== false,
      auditNotesWrite: input.permissions?.auditNotesWrite !== false,
      auditBulkExport: input.permissions?.auditBulkExport === true,
    };
    const row = await this.prisma.auditEngagementInvite.create({
      data: {
        targetOrganizationId,
        inviterUserId,
        inviteeUserId: input.inviteeUserId ?? null,
        inviteeEmail: input.inviteeEmail?.trim().toLowerCase() ?? null,
        tokenHash,
        status: AuditEngagementInviteStatus.PENDING,
        expiresAt,
        permissions,
      },
      select: { id: true, expiresAt: true },
    });
    return {
      id: row.id,
      expiresAt: row.expiresAt.toISOString(),
      token,
    };
  }

  async acceptInvite(
    userId: string,
    userEmail: string,
    inviteId: string,
    token: string,
  ) {
    const row = await this.prisma.auditEngagementInvite.findFirst({
      where: { id: inviteId },
    });
    if (!row) {
      throw new NotFoundException({ code: "AUDIT_INVITE_NOT_FOUND" });
    }
    if (row.status !== AuditEngagementInviteStatus.PENDING) {
      throw new BadRequestException({ code: "AUDIT_INVITE_NOT_PENDING" });
    }
    if (row.revokedAt) {
      throw new ForbiddenException({ code: "AUDIT_INVITE_REVOKED" });
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await this.prisma.auditEngagementInvite.update({
        where: { id: inviteId },
        data: { status: AuditEngagementInviteStatus.EXPIRED },
      });
      throw new BadRequestException({ code: "AUDIT_INVITE_EXPIRED" });
    }
    if (sha256Hex(token) !== row.tokenHash) {
      throw new ForbiddenException({ code: "AUDIT_INVITE_BAD_TOKEN" });
    }
    const emailLc = userEmail.trim().toLowerCase();
    let recipientOk = false;
    if (row.inviteeUserId != null) {
      recipientOk = row.inviteeUserId === userId;
    } else if (row.inviteeEmail != null) {
      recipientOk = row.inviteeEmail.toLowerCase() === emailLc;
    }
    if (!recipientOk) {
      throw new ForbiddenException({
        code: "AUDIT_INVITE_RECIPIENT_MISMATCH",
        message: "This invite is addressed to another user.",
      });
    }
    await this.prisma.auditEngagementInvite.update({
      where: { id: inviteId },
      data: {
        status: AuditEngagementInviteStatus.ACCEPTED,
        acceptedAt: new Date(),
        inviteeUserId: userId,
      },
    });
    return { ok: true, targetOrganizationId: row.targetOrganizationId };
  }

  /**
   * Invitee declines a pending invite (requires the same secret token as accept).
   */
  async declineInvite(
    userId: string,
    userEmail: string,
    inviteId: string,
    token: string,
  ) {
    const row = await this.prisma.auditEngagementInvite.findFirst({
      where: { id: inviteId },
    });
    if (!row) {
      throw new NotFoundException({ code: "AUDIT_INVITE_NOT_FOUND" });
    }
    if (row.status !== AuditEngagementInviteStatus.PENDING) {
      throw new BadRequestException({ code: "AUDIT_INVITE_NOT_PENDING" });
    }
    if (row.revokedAt) {
      throw new ForbiddenException({ code: "AUDIT_INVITE_REVOKED" });
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await this.prisma.auditEngagementInvite.update({
        where: { id: inviteId },
        data: { status: AuditEngagementInviteStatus.EXPIRED },
      });
      throw new BadRequestException({ code: "AUDIT_INVITE_EXPIRED" });
    }
    if (sha256Hex(token) !== row.tokenHash) {
      throw new ForbiddenException({ code: "AUDIT_INVITE_BAD_TOKEN" });
    }
    const emailLc = userEmail.trim().toLowerCase();
    let recipientOk = false;
    if (row.inviteeUserId != null) {
      recipientOk = row.inviteeUserId === userId;
    } else if (row.inviteeEmail != null) {
      recipientOk = row.inviteeEmail.toLowerCase() === emailLc;
    }
    if (!recipientOk) {
      throw new ForbiddenException({
        code: "AUDIT_INVITE_RECIPIENT_MISMATCH",
        message: "This invite is addressed to another user.",
      });
    }
    await this.prisma.auditEngagementInvite.update({
      where: { id: inviteId },
      data: { status: AuditEngagementInviteStatus.DECLINED },
    });
    return { ok: true };
  }

  async listInboxForUser(userId: string, userEmail: string) {
    const emailLc = userEmail.trim().toLowerCase();
    return this.prisma.auditEngagementInvite.findMany({
      where: {
        status: {
          in: [
            AuditEngagementInviteStatus.PENDING,
            AuditEngagementInviteStatus.ACCEPTED,
          ],
        },
        OR: [{ inviteeUserId: userId }, { inviteeEmail: emailLc }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        targetOrganizationId: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        permissions: true,
        targetOrganization: { select: { name: true } },
      },
    });
  }

  async listOutgoingForOrganization(
    targetOrganizationId: string,
    actorUserId: string,
  ) {
    const inviter = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId: targetOrganizationId,
        userId: actorUserId,
        deletedAt: null,
        role: { in: [UserRole.OWNER, UserRole.ADMIN] },
      },
      select: { userId: true },
    });
    if (!inviter) {
      throw new ForbiddenException();
    }
    return this.prisma.auditEngagementInvite.findMany({
      where: { targetOrganizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        inviteeEmail: true,
        inviteeUserId: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        permissions: true,
      },
    });
  }

  async revokeInvite(
    targetOrganizationId: string,
    actorUserId: string,
    inviteId: string,
  ) {
    const inviter = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId: targetOrganizationId,
        userId: actorUserId,
        deletedAt: null,
        role: { in: [UserRole.OWNER, UserRole.ADMIN] },
      },
      select: { userId: true },
    });
    if (!inviter) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.auditEngagementInvite.findFirst({
      where: { id: inviteId, targetOrganizationId },
    });
    if (!row) {
      throw new NotFoundException();
    }
    await this.prisma.auditEngagementInvite.update({
      where: { id: inviteId },
      data: {
        status: AuditEngagementInviteStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
    return { ok: true };
  }

  /**
   * Validates invite id + plaintext token for an authenticated user (accepted invite).
   */
  async resolveActiveEngagement(
    userId: string,
    userEmail: string,
    inviteId: string,
    token: string,
  ): Promise<{
    targetOrganizationId: string;
    inviteId: string;
    permissions: AuditEngagementInvitePermissions;
    organizationName: string;
  } | null> {
    const row = await this.prisma.auditEngagementInvite.findFirst({
      where: { id: inviteId },
      include: { targetOrganization: { select: { name: true } } },
    });
    if (!row || row.status !== AuditEngagementInviteStatus.ACCEPTED) {
      return null;
    }
    if (sha256Hex(token) !== row.tokenHash) {
      return null;
    }
    if (row.inviteeUserId !== userId) {
      return null;
    }
    if (row.revokedAt) {
      return null;
    }
    if (row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    const has = await this.subscriptionAccess.hasModule(
      row.targetOrganizationId,
      ModuleEntitlement.AUDIT_HUB,
    );
    if (!has) {
      return null;
    }
    return {
      targetOrganizationId: row.targetOrganizationId,
      inviteId: row.id,
      permissions: parsePermissions(row.permissions),
      organizationName: row.targetOrganization.name,
    };
  }
}
