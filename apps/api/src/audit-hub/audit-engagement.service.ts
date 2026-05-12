import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditEngagementStatus,
  UserRole,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditEngagementService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(organizationId: string, id: string) {
    const row = await this.prisma.auditEngagement.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        title: true,
        periodFrom: true,
        periodTo: true,
        status: true,
        sampleIds: true,
        createdAt: true,
        createdByUserId: true,
      },
    });
    if (!row) {
      throw new NotFoundException();
    }
    return row;
  }

  async list(organizationId: string) {
    return this.prisma.auditEngagement.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        periodFrom: true,
        periodTo: true,
        status: true,
        sampleIds: true,
        createdAt: true,
        createdByUserId: true,
      },
    });
  }

  async create(
    organizationId: string,
    userId: string,
    body: {
      title: string;
      periodFrom?: string;
      periodTo?: string;
      sampleIds?: string[];
    },
  ) {
    const m = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId,
        deletedAt: null,
        role: {
          in: [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.ACCOUNTANT,
            UserRole.AUDITOR,
          ],
        },
      },
      select: { userId: true },
    });
    if (!m) {
      throw new ForbiddenException();
    }
    const title = body.title?.trim();
    if (!title || title.length > 200) {
      throw new BadRequestException({ code: "AUDIT_ENGAGEMENT_TITLE" });
    }
    const sampleIds = Array.isArray(body.sampleIds)
      ? body.sampleIds.filter((x) => typeof x === "string")
      : [];
    return this.prisma.auditEngagement.create({
      data: {
        organizationId,
        createdByUserId: userId,
        title,
        periodFrom: body.periodFrom ? new Date(body.periodFrom) : null,
        periodTo: body.periodTo ? new Date(body.periodTo) : null,
        sampleIds,
        status: AuditEngagementStatus.OPEN,
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    status: AuditEngagementStatus,
  ) {
    const row = await this.prisma.auditEngagement.findFirst({
      where: { id, organizationId },
      select: { id: true, createdByUserId: true },
    });
    if (!row) {
      throw new NotFoundException();
    }
    const m = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId,
        deletedAt: null,
        role: {
          in: [UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT],
        },
      },
      select: { userId: true },
    });
    if (!m && row.createdByUserId !== userId) {
      throw new ForbiddenException();
    }
    return this.prisma.auditEngagement.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }
}
