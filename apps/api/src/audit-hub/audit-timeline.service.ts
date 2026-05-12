import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ACTIVITY_SLUG_TO_AUDIT_ENTITY_TYPE,
  isActivityEntitySlug,
  type ActivityEntitySlug,
} from "../activity-stream/activity-stream.constants";
import type { ListAuditHubTimelineQueryDto } from "./dto/list-audit-hub-timeline.dto";

@Injectable()
export class AuditTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(organizationId: string, query: ListAuditHubTimelineQueryDto) {
    const take = query.take ?? 50;
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({ code: "INVALID_FROM" });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({ code: "INVALID_TO" });
    }

    const createdFilter =
      from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};

    if (query.entityType && query.entityId) {
      if (!isActivityEntitySlug(query.entityType)) {
        throw new BadRequestException({ code: "INVALID_ENTITY_TYPE" });
      }
      const slug = query.entityType as ActivityEntitySlug;
      const auditEntity = ACTIVITY_SLUG_TO_AUDIT_ENTITY_TYPE[slug];
      const [logs, activities] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: {
            organizationId,
            entityType: auditEntity,
            entityId: query.entityId,
            ...(query.userId ? { userId: query.userId } : {}),
            ...(query.action ? { action: query.action } : {}),
            ...createdFilter,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
          select: {
            id: true,
            userId: true,
            entityType: true,
            entityId: true,
            action: true,
            createdAt: true,
            oldValues: true,
            newValues: true,
            changes: true,
          },
        }),
        this.prisma.entityActivity.findMany({
          where: {
            organizationId,
            entityType: slug,
            entityId: query.entityId,
            ...createdFilter,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
          select: {
            id: true,
            verb: true,
            summary: true,
            actorUserId: true,
            createdAt: true,
            payload: true,
          },
        }),
      ]);

      const items: Array<
        | {
            kind: "audit_log";
            id: string;
            userId: string | null;
            entityType: string;
            entityId: string;
            action: string;
            createdAt: string;
            oldValues: unknown;
            newValues: unknown;
            changes: unknown;
          }
        | {
            kind: "activity";
            id: string;
            verb: string;
            summary: string | null;
            actorUserId: string | null;
            createdAt: string;
            payload: unknown;
          }
      > = [];

      for (const l of logs) {
        items.push({
          kind: "audit_log",
          id: l.id,
          userId: l.userId,
          entityType: l.entityType,
          entityId: l.entityId,
          action: l.action,
          createdAt: l.createdAt.toISOString(),
          oldValues: l.oldValues,
          newValues: l.newValues,
          changes: l.changes,
        });
      }
      for (const a of activities) {
        items.push({
          kind: "activity",
          id: a.id,
          verb: a.verb,
          summary: a.summary,
          actorUserId: a.actorUserId,
          createdAt: a.createdAt.toISOString(),
          payload: a.payload,
        });
      }

      items.sort(
        (x, y) =>
          new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime(),
      );
      return { items: items.slice(0, take) };
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...createdFilter,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true,
        userId: true,
        entityType: true,
        entityId: true,
        action: true,
        createdAt: true,
      },
    });

    return {
      items: logs.map((l) => ({
        kind: "audit_log" as const,
        id: l.id,
        userId: l.userId,
        entityType: l.entityType,
        entityId: l.entityId,
        action: l.action,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }
}
