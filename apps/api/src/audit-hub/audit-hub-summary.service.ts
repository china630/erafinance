import { Injectable } from "@nestjs/common";
import { EntityCommentKind } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { AuditHubBackdatingService } from "./audit-hub-backdating.service";

@Injectable()
export class AuditHubSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backdating: AuditHubBackdatingService,
  ) {}

  async getSummary(organizationId: string) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [auditNotes, samples, auditMutations, backdating] =
      await Promise.all([
        this.prisma.entityComment.count({
          where: {
            organizationId,
            kind: EntityCommentKind.AUDIT_NOTE,
            deletedAt: null,
            createdAt: { gte: since },
          },
        }),
        this.prisma.auditSample.count({
          where: { organizationId, createdAt: { gte: since } },
        }),
        this.prisma.auditLog.count({
          where: { organizationId, createdAt: { gte: since } },
        }),
        this.backdating.report(organizationId, {
          thresholdDays: 1,
        }),
      ]);

    return {
      auditNotesLast30Days: auditNotes,
      samplesLast30Days: samples,
      auditMutationsLast30Days: auditMutations,
      backdatedCandidates: backdating.items.length,
    };
  }
}
