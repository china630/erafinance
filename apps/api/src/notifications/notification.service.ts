import { Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationSeverity,
  Prisma,
  UserRole,
} from "@dayday/database";
import { PrismaService } from "../prisma/prisma.service";
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
  constructor(private readonly prisma: PrismaService) {}

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
