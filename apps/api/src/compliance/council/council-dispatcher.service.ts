import { Injectable, NotFoundException } from "@nestjs/common";
import { CouncilVerdictStatus, Prisma } from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CouncilQueueService } from "./council.queue";
import { CouncilQuotaService } from "./council-quota.service";
import type { DeliberateCouncilInput } from "./council.types";

@Injectable()
export class CouncilDispatcherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: CouncilQueueService,
    private readonly quota: CouncilQuotaService,
  ) {}

  async deliberate(input: DeliberateCouncilInput): Promise<{ verdictId: string }> {
    if (input.triggerSource === "MANUAL") {
      await this.quota.assertManualQuota(input.organizationId);
    }

    if (input.riskAuditId) {
      const audit = await this.prisma.riskAudit.findFirst({
        where: { id: input.riskAuditId, organizationId: input.organizationId },
      });
      if (!audit) {
        throw new NotFoundException("Risk audit not found");
      }
    }

    if (input.dedupeKey) {
      const existing = await this.prisma.councilVerdict.findUnique({
        where: {
          organizationId_dedupeKey: {
            organizationId: input.organizationId,
            dedupeKey: input.dedupeKey,
          },
        },
      });
      if (
        existing &&
        (existing.status === CouncilVerdictStatus.QUEUED ||
          existing.status === CouncilVerdictStatus.RUNNING ||
          existing.status === CouncilVerdictStatus.COMPLETED)
      ) {
        return { verdictId: existing.id };
      }
    }

    try {
      const row = await this.prisma.councilVerdict.create({
        data: {
          organizationId: input.organizationId,
          riskAuditId: input.riskAuditId ?? null,
          triggerSource: input.triggerSource,
          targetEntityType: input.target.entityType,
          targetEntityId: input.target.entityId ?? null,
          targetEntityLabel: input.target.label,
          dedupeKey: input.dedupeKey ?? null,
          requestedByUserId: input.requestedByUserId ?? null,
          status: CouncilVerdictStatus.QUEUED,
          elderVerdicts: {} as Prisma.InputJsonValue,
        },
      });

      await this.enqueueExisting(row.id, input.organizationId, input.dedupeKey);
      return { verdictId: row.id };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        input.dedupeKey
      ) {
        const dup = await this.prisma.councilVerdict.findUnique({
          where: {
            organizationId_dedupeKey: {
              organizationId: input.organizationId,
              dedupeKey: input.dedupeKey,
            },
          },
        });
        if (dup) return { verdictId: dup.id };
      }
      throw e;
    }
  }

  async enqueueExisting(
    verdictId: string,
    organizationId: string,
    dedupeKey?: string | null,
  ): Promise<void> {
    const jobId = dedupeKey
      ? `council:${organizationId}:${dedupeKey}`
      : `council:${organizationId}:manual:${verdictId}`;
    await this.queue.enqueue(
      { verdictId, organizationId },
      jobId,
    );
  }
}
