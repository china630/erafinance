import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  AUDIT_ENTITY_TYPE_TO_SLUG,
  type ActivityEntitySlug,
} from "./activity-stream.constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function httpMethodToVerb(method: string): string {
  switch (method.toUpperCase()) {
    case "POST":
      return "created";
    case "PATCH":
    case "PUT":
      return "updated";
    case "DELETE":
      return "deleted";
    default:
      return method.toLowerCase();
  }
}

@Injectable()
export class ActivityStreamEmitterService {
  private readonly logger = new Logger(ActivityStreamEmitterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Best-effort system row for the activity timeline (not a substitute for audit chain).
   */
  async emitFromAuditMutation(params: {
    organizationId: string | null;
    actorUserId: string | null;
    auditEntityType: string;
    entityId: string;
    httpMethod: string;
  }): Promise<void> {
    const { organizationId, actorUserId, auditEntityType, entityId, httpMethod } =
      params;
    if (!organizationId || !UUID_RE.test(entityId)) {
      return;
    }
    const slug = AUDIT_ENTITY_TYPE_TO_SLUG[auditEntityType];
    if (!slug) {
      return;
    }
    const verb = httpMethodToVerb(httpMethod);
    const summary = `${auditEntityType} ${verb}`;
    try {
      await this.prisma.entityActivity.create({
        data: {
          organizationId,
          entityType: slug,
          entityId,
          actorUserId: actorUserId ?? undefined,
          verb,
          summary,
          payload: {
            auditEntityType,
            httpMethod: httpMethod.toUpperCase(),
          },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`entityActivity create skipped: ${msg}`);
    }
  }

  /** Manual domain emit (optional). */
  async emitCustom(params: {
    organizationId: string;
    entityType: ActivityEntitySlug;
    entityId: string;
    actorUserId?: string | null;
    verb: string;
    summary: string;
    payload?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.entityActivity.create({
      data: {
        organizationId: params.organizationId,
        entityType: params.entityType,
        entityId: params.entityId,
        actorUserId: params.actorUserId ?? undefined,
        verb: params.verb,
        summary: params.summary,
        payload: params.payload,
      },
    });
  }
}
