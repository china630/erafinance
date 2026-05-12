import { Injectable, Logger } from "@nestjs/common";
import { NotificationSeverity, UserRole } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

const DEMO_FINISHED_ACTION = "BILLING_DEMO_PERIOD_FINISHED_1ST";

function billingPeriodKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

@Injectable()
export class BillingNotificationService {
  private readonly logger = new Logger(BillingNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyUpcomingInvoice(organizationId: string, now = new Date()): Promise<void> {
    const action = "BILLING_UPCOMING_INVOICE_25TH";
    const entityId = `${organizationId}:${billingPeriodKey(now)}`;
    const exists = await this.prisma.auditLog.findFirst({
      where: {
        organizationId,
        entityType: "billing.notification",
        entityId,
        action,
      },
      select: { id: true },
    });
    if (exists) return;

    const message =
      "Скоро будет выставлен ежемесячный счёт за платные модули ERA Finance.";
    await this.writeBillingNotification({
      organizationId,
      entityId,
      action,
      title: "Скоро ежемесячный счёт",
      message,
      severity: NotificationSeverity.INFO,
      now,
    });
  }

  async notifyDemoPeriodFinished(
    organizationId: string,
    now = new Date(),
  ): Promise<void> {
    const exists = await this.prisma.auditLog.findFirst({
      where: {
        organizationId,
        entityType: "billing.notification",
        entityId: organizationId,
        action: DEMO_FINISHED_ACTION,
      },
      select: { id: true },
    });
    if (exists) return;

    await this.writeBillingNotification({
      organizationId,
      entityId: organizationId,
      action: DEMO_FINISHED_ACTION,
      title: "Бесплатный период завершён",
      message:
        "Ваш бесплатный входной период завершен. С 1-го числа начался платный период пользования.",
      severity: NotificationSeverity.WARNING,
      now,
    });
  }

  private async writeBillingNotification(input: {
    organizationId: string;
    entityId: string;
    action: string;
    title: string;
    message: string;
    severity: NotificationSeverity;
    now: Date;
  }): Promise<void> {
    const members = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId: input.organizationId,
        role: { in: [UserRole.OWNER, UserRole.ACCOUNTANT] },
      },
      select: { userId: true },
    });
    const userIds = [...new Set(members.map((m) => m.userId))];

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.auditLog.findFirst({
        where: {
          organizationId: input.organizationId,
          entityType: "billing.notification",
          entityId: input.entityId,
          action: input.action,
        },
        select: { id: true },
      });
      if (exists) return;

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: null,
          entityType: "billing.notification",
          entityId: input.entityId,
          action: input.action,
          newValues: {
            message: input.message,
            notifiedAt: input.now.toISOString(),
          },
        },
      });

      if (userIds.length > 0) {
        await tx.notification.createMany({
          data: userIds.map((userId) => ({
            organizationId: input.organizationId,
            userId,
            title: input.title,
            message: input.message,
            severity: input.severity,
            link: "/admin/billing",
          })),
        });
      }
    });

    this.logger.log(
      `${input.action}: notified ${userIds.length} user(s) for organization ${input.organizationId}`,
    );
  }
}
