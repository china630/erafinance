import { createHash } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Inject } from "@nestjs/common";
import {
  DisputeSeverity,
  DisputeStatus,
  SecurityMode,
  UserRole,
} from "@erafinance/database";
import { AuditService } from "../../audit/audit.service";
import { STORAGE_SERVICE, type StorageService } from "../../storage/storage.interface";
import { NotificationService } from "../../notifications/notification.service";
import { PrismaService } from "../../prisma/prisma.service";
import { runWithTenantContextAsync } from "../../prisma/tenant-context";
import { DualApprovalService } from "../dual-approval/dual-approval.service";
import { DUAL_APPROVAL_PURPOSE_OWNERSHIP_TRANSFER } from "../dual-approval/dual-approval.constants";
import { DISPUTE_COUNTER_CLAIM_JWT_TYP } from "../step-up/step-up.constants";
import { SnapshotService } from "../snapshot/snapshot.service";
import { TransferCertificateService } from "./transfer-certificate.service";

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: SnapshotService,
    private readonly notifications: NotificationService,
    private readonly dualApproval: DualApprovalService,
    private readonly audit: AuditService,
    private readonly certificates: TransferCertificateService,
    private readonly jwt: JwtService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async issueCounterClaimToken(params: {
    disputeId: string;
    organizationId: string;
    incumbentUserId: string;
  }): Promise<string> {
    return this.jwt.signAsync(
      {
        typ: DISPUTE_COUNTER_CLAIM_JWT_TYP,
        disputeId: params.disputeId,
        organizationId: params.organizationId,
        sub: params.incumbentUserId,
      },
      { expiresIn: "14d" },
    );
  }

  private async verifyCounterClaimToken(token: string): Promise<{
    disputeId: string;
    organizationId: string;
    incumbentUserId: string;
  }> {
    try {
      const p = await this.jwt.verifyAsync<{
        typ?: string;
        disputeId?: string;
        organizationId?: string;
        sub?: string;
      }>(token);
      if (
        p.typ !== DISPUTE_COUNTER_CLAIM_JWT_TYP ||
        !p.disputeId ||
        !p.organizationId ||
        !p.sub
      ) {
        throw new ForbiddenException("Invalid counter-claim token");
      }
      return {
        disputeId: p.disputeId,
        organizationId: p.organizationId,
        incumbentUserId: p.sub,
      };
    } catch (e) {
      if (e instanceof ForbiddenException) {
        throw e;
      }
      throw new ForbiddenException("Invalid counter-claim token");
    }
  }

  async openDispute(params: {
    organizationId: string;
    claimantUserId: string;
    incumbentUserId: string;
    evidenceKeys: string[];
    severity: DisputeSeverity;
  }) {
    const dispute = await this.prisma.$transaction(async (tx) => {
      const d = await tx.ownershipDispute.create({
        data: {
          organizationId: params.organizationId,
          claimantUserId: params.claimantUserId,
          incumbentUserId: params.incumbentUserId,
          evidenceKeys: params.evidenceKeys,
          severity: params.severity,
          status: DisputeStatus.EVIDENCE_REQUIRED,
        },
      });
      await tx.organizationSecurityState.upsert({
        where: { organizationId: params.organizationId },
        create: {
          organizationId: params.organizationId,
          mode: SecurityMode.DISPUTE,
          activeDisputeId: d.id,
        },
        update: {
          mode: SecurityMode.DISPUTE,
          activeDisputeId: d.id,
        },
      });
      return d;
    });
    const counterToken = await this.issueCounterClaimToken({
      disputeId: dispute.id,
      organizationId: params.organizationId,
      incumbentUserId: params.incumbentUserId,
    });
    await this.snapshots.takeSnapshot(params.organizationId, "dispute_open", null).catch((e) =>
      this.logger.warn(`Snapshot after dispute_open failed: ${e}`),
    );
    await runWithTenantContextAsync(
      { organizationId: params.organizationId, skipTenantFilter: false },
      () =>
        this.notifications.notifyOwnershipDisputeOpened({
          organizationId: params.organizationId,
          incumbentUserId: params.incumbentUserId,
          disputeId: dispute.id,
          counterClaimToken: counterToken,
        }),
    ).catch((e) => this.logger.warn(`Notify incumbent failed: ${e}`));
    return dispute;
  }

  async notifyIncumbent(disputeId: string): Promise<void> {
    const d = await this.prisma.ownershipDispute.findUnique({ where: { id: disputeId } });
    if (!d) {
      throw new BadRequestException("Dispute not found");
    }
    const counterToken = await this.issueCounterClaimToken({
      disputeId: d.id,
      organizationId: d.organizationId,
      incumbentUserId: d.incumbentUserId,
    });
    await runWithTenantContextAsync(
      { organizationId: d.organizationId, skipTenantFilter: false },
      () =>
        this.notifications.notifyOwnershipDisputeOpened({
          organizationId: d.organizationId,
          incumbentUserId: d.incumbentUserId,
          disputeId: d.id,
          counterClaimToken: counterToken,
        }),
    );
  }

  async patchDisputeStatusScoped(
    organizationId: string,
    disputeId: string,
    status: DisputeStatus,
  ): Promise<void> {
    const d = await this.prisma.ownershipDispute.findFirst({
      where: { id: disputeId, organizationId },
    });
    if (!d) {
      throw new BadRequestException("Dispute not found for organization");
    }
    await this.prisma.ownershipDispute.update({
      where: { id: disputeId },
      data: { status },
    });
  }

  async requestExecution(disputeId: string, requesterId: string) {
    const d = await this.prisma.ownershipDispute.findUnique({ where: { id: disputeId } });
    if (!d) {
      throw new BadRequestException("Dispute not found");
    }
    if (d.status !== DisputeStatus.APPROVED) {
      throw new BadRequestException("Dispute must be APPROVED before execution request");
    }
    const row = await this.dualApproval.createRequestWithExpiry(
      requesterId,
      DUAL_APPROVAL_PURPOSE_OWNERSHIP_TRANSFER,
      { disputeId, organizationId: d.organizationId },
    );
    await this.prisma.ownershipDispute.update({
      where: { id: disputeId },
      data: { approvalRequestId: row.id },
    });
    return row;
  }

  async executeTransfer(params: {
    disputeId: string;
    dualApprovalRequestId: string;
    executorUserId: string;
  }) {
    const dispute = await this.prisma.ownershipDispute.findUnique({
      where: { id: params.disputeId },
      include: { organization: { select: { id: true, name: true, ownerId: true } } },
    });
    if (!dispute) {
      throw new BadRequestException("Dispute not found");
    }
    if (dispute.status !== DisputeStatus.APPROVED) {
      throw new BadRequestException("Dispute must be APPROVED");
    }
    const da = await this.prisma.dualApprovalRequest.findUnique({
      where: { id: params.dualApprovalRequestId },
    });
    if (!da || (da.payload as { disputeId?: string })?.disputeId !== dispute.id) {
      throw new ForbiddenException("Dual approval payload does not match dispute");
    }

    return this.dualApproval.executeIfApproved(params.dualApprovalRequestId, async () => {
      const snap = await this.snapshots.takeSnapshot(
        dispute.organizationId,
        "pre_transfer",
        params.executorUserId,
      );
      const orgBefore = { ownerId: dispute.organization.ownerId };
      const pdf = await this.certificates.buildTransferCertificatePdf({
        organizationName: dispute.organization.name,
        disputeId: dispute.id,
        claimantId: dispute.claimantUserId,
        incumbentId: dispute.incumbentUserId,
      });
      const certKey = `evidence/disputes/${dispute.organizationId}/${dispute.id}-transfer-cert.pdf`;
      await this.storage.putObject(certKey, pdf, { contentType: "application/pdf" });
      const certSha = createHash("sha256").update(pdf).digest("hex");

      const lockUntil = new Date();
      lockUntil.setUTCDate(lockUntil.getUTCDate() + 30);

      await this.prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: dispute.organizationId },
          data: { ownerId: dispute.claimantUserId },
        });
        await tx.organizationMembership.upsert({
          where: {
            userId_organizationId: {
              userId: dispute.claimantUserId,
              organizationId: dispute.organizationId,
            },
          },
          create: {
            userId: dispute.claimantUserId,
            organizationId: dispute.organizationId,
            role: UserRole.OWNER,
          },
          update: { role: UserRole.OWNER },
        });
        const incMembership = await tx.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: dispute.incumbentUserId,
              organizationId: dispute.organizationId,
            },
          },
        });
        if (incMembership) {
          if (dispute.severity === DisputeSeverity.HARD) {
            await tx.organizationMembership.delete({
              where: {
                userId_organizationId: {
                  userId: dispute.incumbentUserId,
                  organizationId: dispute.organizationId,
                },
              },
            });
          } else {
            await tx.organizationMembership.update({
              where: {
                userId_organizationId: {
                  userId: dispute.incumbentUserId,
                  organizationId: dispute.organizationId,
                },
              },
              data: { role: UserRole.ADMIN },
            });
          }
        }
        await tx.organizationSecurityState.update({
          where: { organizationId: dispute.organizationId },
          data: {
            mode: SecurityMode.POST_TRANSFER_LOCK,
            lockUntil,
            activeDisputeId: null,
          },
        });
        await tx.ownershipDispute.update({
          where: { id: dispute.id },
          data: {
            status: DisputeStatus.EXECUTED,
            executedAt: new Date(),
            signedCertificateKey: certKey,
          },
        });
      });

      await this.audit.appendTenantAuditChainEntry({
        organizationId: dispute.organizationId,
        userId: params.executorUserId,
        entityType: "platform.tenant.ownership.transferred",
        entityId: dispute.id,
        action: "EXECUTE",
        oldValues: {
          ownerId: orgBefore.ownerId,
          approverIds: da.approverIds,
          preTransferSnapshotId: snap.id,
        },
        newValues: {
          ownerId: dispute.claimantUserId,
          certificateSha256: certSha,
          certificateKey: certKey,
        },
        changes: { dualApprovalRequestId: params.dualApprovalRequestId },
      });

      return {
        disputeId: dispute.id,
        snapshotId: snap.id,
        certificateKey: certKey,
        certificateSha256: certSha,
      };
    });
  }

  async recordCounterClaim(disputeId: string, token: string, note: string): Promise<void> {
    const v = await this.verifyCounterClaimToken(token);
    if (v.disputeId !== disputeId) {
      throw new ForbiddenException("Token does not match dispute");
    }
    const d = await this.prisma.ownershipDispute.findUnique({ where: { id: disputeId } });
    if (!d || d.incumbentUserId !== v.incumbentUserId) {
      throw new ForbiddenException("Dispute mismatch");
    }
    await this.prisma.ownershipDispute.update({
      where: { id: disputeId },
      data: { counterClaimNote: note, status: DisputeStatus.EVIDENCE_REVIEW },
    });
  }

  async getPublicDisputeMeta(disputeId: string, token: string) {
    const v = await this.verifyCounterClaimToken(token);
    if (v.disputeId !== disputeId) {
      throw new ForbiddenException("Token does not match dispute");
    }
    const d = await this.prisma.ownershipDispute.findUnique({
      where: { id: disputeId },
      select: {
        status: true,
        organization: { select: { name: true } },
      },
    });
    if (!d) {
      throw new BadRequestException("Dispute not found");
    }
    return {
      status: d.status,
      organizationName: d.organization.name,
    };
  }

  async listForOrganization(organizationId: string) {
    return this.prisma.ownershipDispute.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getSecurityState(organizationId: string) {
    return this.prisma.organizationSecurityState.findUnique({
      where: { organizationId },
    });
  }
}
