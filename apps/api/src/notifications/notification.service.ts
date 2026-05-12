import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NotificationSeverity,
  Prisma,
  UserRole,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import {
  OWNERSHIP_DISPUTE_IN_APP_TITLE,
  ownershipDisputeEmailBody,
  ownershipDisputeEmailSubject,
  ownershipDisputeInAppMessage,
} from "./ownership-dispute-notification.copy";
import type { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";

export type CreateNotificationInput = {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  link?: string | null;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Internal API: workers, cron, domain services. Requires tenant context with matching `organizationId`.
   */
  async createNotification(input: CreateNotificationInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        title: input.title,
        message: input.message,
        severity: input.severity ?? NotificationSeverity.INFO,
        link: input.link ?? null,
      },
    });
  }

  /**
   * Notify all OWNER and ACCOUNTANT members (e.g. payroll / billing).
   */
  /**
   * OWNERSHIP_DISPUTE_OPENED — in-app + optional email/SMS (+994 queue stub).
   * `counterClaimToken` is a short-lived JWT for `/dispute/[id]?t=…` counter-claim flow.
   */
  async notifyOwnershipDisputeOpened(params: {
    organizationId: string;
    incumbentUserId: string;
    disputeId: string;
    counterClaimToken?: string;
  }): Promise<void> {
    const disputeUrlPath = `/dispute/${params.disputeId}${params.counterClaimToken ? `?t=${encodeURIComponent(params.counterClaimToken)}` : ""}`;
    await this.createNotification({
      organizationId: params.organizationId,
      userId: params.incumbentUserId,
      title: OWNERSHIP_DISPUTE_IN_APP_TITLE,
      message: ownershipDisputeInAppMessage(params.disputeId),
      severity: NotificationSeverity.CRITICAL,
      link: disputeUrlPath,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: params.incumbentUserId },
      select: { email: true },
    });
    const webOrigin = (
      this.config.get<string>("WEB_APP_PUBLIC_URL") ??
      this.config.get<string>("WEB_URL") ??
      "http://localhost:3000"
    ).replace(/\/$/, "");

    if (user?.email) {
      await this.mail.sendMail({
        to: user.email,
        subject: ownershipDisputeEmailSubject(),
        text: ownershipDisputeEmailBody(disputeUrlPath, webOrigin),
      });
    }

    this.logger.log(
      `[OWNERSHIP_DISPUTE_OPENED][SMS stub] +994 queue — dispute=${params.disputeId} (provider wiring R2.7+)`,
    );
  }

  async notifyFinanceUsers(
    organizationId: string,
    payload: {
      title: string;
      message: string;
      severity?: NotificationSeverity;
      link?: string | null;
    },
  ): Promise<void> {
    const members = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        role: { in: [UserRole.OWNER, UserRole.ACCOUNTANT] },
      },
      select: { userId: true },
    });
    const userIds = [...new Set(members.map((m) => m.userId))];
    if (userIds.length === 0) return;

    const sev = payload.severity ?? NotificationSeverity.INFO;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        organizationId,
        userId,
        title: payload.title,
        message: payload.message,
        severity: sev,
        link: payload.link ?? null,
      })),
    });
  }

  async list(
    _organizationId: string,
    userId: string,
    query: ListNotificationsQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly === true ? { isRead: false } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markRead(
    organizationId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string; isRead: boolean }> {
    const res = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    if (res.count === 0) {
      throw new NotFoundException("Notification not found");
    }
    return { id, isRead: true };
  }

  async markAllRead(
    organizationId: string,
    userId: string,
  ): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: res.count };
  }
}
