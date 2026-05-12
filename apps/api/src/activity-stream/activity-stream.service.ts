import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EntityCommentKind,
  NotificationSeverity,
  UserRole,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notifications/notification.service";
import type { ActivityEntitySlug } from "./activity-stream.constants";
import { isActivityEntitySlug } from "./activity-stream.constants";
import type { CreateEntityCommentDto } from "./dto/create-entity-comment.dto";
import type { UpdateEntityCommentDto } from "./dto/update-entity-comment.dto";

const MENTION_EMAIL_RE = /@\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

function extractMentionEmails(body: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_EMAIL_RE.source, MENTION_EMAIL_RE.flags);
  while ((m = re.exec(body)) !== null) {
    const email = m[1]?.trim().toLowerCase();
    if (email) {
      out.add(email);
    }
  }
  return [...out];
}

function buildEntityLink(slug: ActivityEntitySlug, entityId: string): string {
  switch (slug) {
    case "invoice":
      return `/sales/invoices?invoice=${encodeURIComponent(entityId)}`;
    case "counterparty":
      return `/crm/counterparties/${encodeURIComponent(entityId)}`;
    case "inventory_audit":
      return `/inventory/audits/${encodeURIComponent(entityId)}`;
    case "employee":
      return `/employees?highlight=${encodeURIComponent(entityId)}`;
    case "product":
      return `/products?highlight=${encodeURIComponent(entityId)}`;
    case "payroll_slip":
      return `/hr/payroll?slip=${encodeURIComponent(entityId)}`;
    case "customs_declaration":
      return `/customs/declarations/${encodeURIComponent(entityId)}`;
    default:
      return "/";
  }
}

@Injectable()
export class ActivityStreamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private async entityExistsInOrg(
    organizationId: string,
    slug: ActivityEntitySlug,
    entityId: string,
  ): Promise<boolean> {
    switch (slug) {
      case "invoice": {
        const row = await this.prisma.invoice.findFirst({
          where: { id: entityId, organizationId },
          select: { id: true },
        });
        return !!row;
      }
      case "counterparty": {
        const row = await this.prisma.counterparty.findFirst({
          where: { id: entityId, organizationId },
          select: { id: true },
        });
        return !!row;
      }
      case "employee": {
        const row = await this.prisma.employee.findFirst({
          where: { id: entityId, organizationId },
          select: { id: true },
        });
        return !!row;
      }
      case "product": {
        const row = await this.prisma.product.findFirst({
          where: { id: entityId, organizationId },
          select: { id: true },
        });
        return !!row;
      }
      case "inventory_audit": {
        const row = await this.prisma.inventoryAudit.findFirst({
          where: { id: entityId, organizationId },
          select: { id: true },
        });
        return !!row;
      }
      case "payroll_slip": {
        const row = await this.prisma.payrollSlip.findFirst({
          where: { id: entityId, organizationId },
          select: { id: true },
        });
        return !!row;
      }
      case "customs_declaration": {
        const row = await this.prisma.customsDeclaration.findFirst({
          where: { id: entityId, organizationId },
          select: { id: true },
        });
        return !!row;
      }
      default:
        return false;
    }
  }

  async getTimeline(
    organizationId: string,
    entityTypeParam: string,
    entityId: string,
  ): Promise<{
    items: Array<
      | {
          kind: "activity";
          id: string;
          verb: string;
          summary: string | null;
          actorUserId: string | null;
          createdAt: string;
          payload: unknown;
        }
      | {
          kind: "comment";
          id: string;
          body: string;
          commentKind: EntityCommentKind;
          authorUserId: string;
          authorEmail: string | null;
          createdAt: string;
          updatedAt: string;
        }
    >;
  }> {
    if (!isActivityEntitySlug(entityTypeParam)) {
      throw new BadRequestException({ code: "ACTIVITY_INVALID_ENTITY_TYPE" });
    }
    const slug = entityTypeParam;
    const ok = await this.entityExistsInOrg(organizationId, slug, entityId);
    if (!ok) {
      throw new NotFoundException();
    }

    const [activities, comments] = await Promise.all([
      this.prisma.entityActivity.findMany({
        where: { organizationId, entityType: slug, entityId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
        select: {
          id: true,
          verb: true,
          summary: true,
          actorUserId: true,
          createdAt: true,
          payload: true,
        },
      }),
      this.prisma.entityComment.findMany({
        where: {
          organizationId,
          entityType: slug,
          entityId,
          deletedAt: null,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
        select: {
          id: true,
          body: true,
          kind: true,
          authorUserId: true,
          createdAt: true,
          updatedAt: true,
          authorUser: { select: { email: true } },
        },
      }),
    ]);

    const merged: Array<
      | {
          kind: "activity";
          id: string;
          verb: string;
          summary: string | null;
          actorUserId: string | null;
          createdAt: string;
          payload: unknown;
        }
      | {
          kind: "comment";
          id: string;
          body: string;
          commentKind: EntityCommentKind;
          authorUserId: string;
          authorEmail: string | null;
          createdAt: string;
          updatedAt: string;
        }
    > = [];

    for (const a of activities) {
      merged.push({
        kind: "activity",
        id: a.id,
        verb: a.verb,
        summary: a.summary,
        actorUserId: a.actorUserId,
        createdAt: a.createdAt.toISOString(),
        payload: a.payload,
      });
    }
    for (const c of comments) {
      merged.push({
        kind: "comment",
        id: c.id,
        body: c.body,
        commentKind: c.kind,
        authorUserId: c.authorUserId,
        authorEmail: c.authorUser.email,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      });
    }

    merged.sort((x, y) => {
      const tx = new Date(x.createdAt).getTime();
      const ty = new Date(y.createdAt).getTime();
      if (ty !== tx) {
        return ty - tx;
      }
      return y.id.localeCompare(x.id);
    });

    return { items: merged.slice(0, 250) };
  }

  async createComment(
    organizationId: string,
    authorUserId: string,
    entityTypeParam: string,
    entityId: string,
    dto: CreateEntityCommentDto,
    authorRole: UserRole,
    allowEngagementAuditNote?: boolean,
  ): Promise<{ id: string }> {
    if (!isActivityEntitySlug(entityTypeParam)) {
      throw new BadRequestException({ code: "ACTIVITY_INVALID_ENTITY_TYPE" });
    }
    const slug = entityTypeParam;
    const ok = await this.entityExistsInOrg(organizationId, slug, entityId);
    if (!ok) {
      throw new NotFoundException();
    }

    const emails = extractMentionEmails(dto.body);
    let kind: EntityCommentKind;
    if (authorRole === UserRole.AUDITOR) {
      kind = EntityCommentKind.AUDIT_NOTE;
    } else if (
      allowEngagementAuditNote &&
      dto.kind === EntityCommentKind.AUDIT_NOTE
    ) {
      kind = EntityCommentKind.AUDIT_NOTE;
    } else if (dto.kind === EntityCommentKind.AUDIT_NOTE) {
      throw new ForbiddenException({
        code: "AUDIT_NOTE_FORBIDDEN",
        message: "Only users with AUDITOR role may create audit notes.",
      });
    } else {
      kind = EntityCommentKind.NORMAL;
    }

    const mentionedUsers =
      emails.length === 0
        ? []
        : await this.prisma.organizationMembership.findMany({
            where: {
              organizationId,
              deletedAt: null,
              user: { email: { in: emails, mode: "insensitive" } },
            },
            select: { userId: true, user: { select: { email: true } } },
          });

    const comment = await this.prisma.$transaction(async (tx) => {
      const row = await tx.entityComment.create({
        data: {
          organizationId,
          entityType: slug,
          entityId,
          authorUserId,
          body: dto.body.trim(),
          kind,
        },
      });
      const uniq = new Map<string, string>();
      for (const m of mentionedUsers) {
        uniq.set(m.userId, m.user.email);
      }
      for (const userId of uniq.keys()) {
        if (userId === authorUserId) {
          continue;
        }
        await tx.entityCommentMention.create({
          data: { commentId: row.id, mentionedUserId: userId },
        });
      }
      return row;
    });

    const link = buildEntityLink(slug, entityId);
    for (const m of mentionedUsers) {
      if (m.userId === authorUserId) {
        continue;
      }
      await this.notifications.createNotification({
        organizationId,
        userId: m.userId,
        title: "Mention in comment",
        message: `You were mentioned on ${slug.replace(/_/g, " ")}`,
        severity: NotificationSeverity.INFO,
        link,
      });
    }

    return { id: comment.id };
  }

  async updateComment(
    organizationId: string,
    commentId: string,
    editorUserId: string,
    dto: UpdateEntityCommentDto,
    editorRole: UserRole,
  ): Promise<void> {
    const row = await this.prisma.entityComment.findFirst({
      where: { id: commentId, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException();
    }
    if (row.authorUserId !== editorUserId) {
      throw new ForbiddenException();
    }
    if (
      editorRole === UserRole.AUDITOR &&
      row.kind !== EntityCommentKind.AUDIT_NOTE
    ) {
      throw new ForbiddenException({
        code: "AUDITOR_COMMENT_KIND",
        message: "AUDITOR may only edit audit notes.",
      });
    }
    await this.prisma.entityComment.update({
      where: { id: commentId },
      data: { body: dto.body.trim() },
    });
  }

  async softDeleteComment(
    organizationId: string,
    commentId: string,
    editorUserId: string,
    reason?: string | null,
    editorRole?: UserRole,
  ): Promise<void> {
    const row = await this.prisma.entityComment.findFirst({
      where: { id: commentId, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException();
    }
    if (row.authorUserId !== editorUserId) {
      throw new ForbiddenException();
    }
    if (
      editorRole === UserRole.AUDITOR &&
      row.kind !== EntityCommentKind.AUDIT_NOTE
    ) {
      throw new ForbiddenException({
        code: "AUDITOR_COMMENT_KIND",
        message: "AUDITOR may only delete audit notes.",
      });
    }
    await this.prisma.entityComment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
        deletedByUserId: editorUserId,
        deletedReason: reason?.trim() || "deleted",
      },
    });
  }
}
