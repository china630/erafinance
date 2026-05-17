import { Injectable, Logger } from "@nestjs/common";
import { CouncilVerdictStatus, Prisma, RiskAuditStatus } from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CouncilSnapshotBuilderService } from "./council-snapshot-builder.service";
import { CouncilElderAgents } from "./council-elder.agents";
import { CouncilSynthesizerService } from "./council-synthesizer.service";
import type { CouncilDeliberationJobPayload } from "./council.types";

@Injectable()
export class CouncilEngineService {
  private readonly logger = new Logger(CouncilEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: CouncilSnapshotBuilderService,
    private readonly elders: CouncilElderAgents,
    private readonly synthesizer: CouncilSynthesizerService,
  ) {}

  async runDeliberation(payload: CouncilDeliberationJobPayload): Promise<void> {
    const verdict = await this.prisma.councilVerdict.findFirst({
      where: { id: payload.verdictId, organizationId: payload.organizationId },
    });
    if (!verdict) {
      this.logger.warn(`Council verdict ${payload.verdictId} not found`);
      return;
    }
    if (
      verdict.status === CouncilVerdictStatus.COMPLETED ||
      verdict.status === CouncilVerdictStatus.FAILED
    ) {
      return;
    }

    await this.prisma.councilVerdict.update({
      where: { id: verdict.id },
      data: { status: CouncilVerdictStatus.RUNNING },
    });

    try {
      const snapshot = await this.snapshots.buildSnapshot(
        verdict.organizationId,
        verdict.triggerSource,
        {
          entityType: verdict.targetEntityType,
          entityId: verdict.targetEntityId,
          label: verdict.targetEntityLabel,
        },
        verdict.riskAuditId,
      );

      const consensus = await this.elders.deliberateAll(snapshot);
      const synth = await this.synthesizer.synthesize(consensus.elderVerdicts);

      await this.prisma.$transaction(async (tx) => {
        await tx.councilVerdict.update({
          where: { id: verdict.id },
          data: {
            status: CouncilVerdictStatus.COMPLETED,
            elderVerdicts: consensus.elderVerdicts as Prisma.InputJsonValue,
            finalScore: consensus.finalScore,
            finalSeverity: consensus.finalSeverity,
            summaryAz: synth.summaryAz,
            summaryRu: synth.summaryRu,
            suggestedAction: synth.suggestedAction,
            errorMessage: null,
          },
        });

        if (verdict.riskAuditId) {
          const audit = await tx.riskAudit.findFirst({
            where: {
              id: verdict.riskAuditId,
              organizationId: verdict.organizationId,
            },
          });
          if (audit && audit.status === RiskAuditStatus.PENDING) {
            await tx.riskAudit.update({
              where: { id: audit.id },
              data: {
                severity: consensus.finalSeverity,
                description: `[Council] ${synth.suggestedAction.slice(0, 500)}`,
                metadata: {
                  ...(typeof audit.metadata === "object" && audit.metadata
                    ? (audit.metadata as Record<string, unknown>)
                    : {}),
                  councilVerdictId: verdict.id,
                  councilFinalScore: consensus.finalScore,
                } as Prisma.InputJsonValue,
              },
            });
          }
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Council deliberation failed: ${msg}`);
      await this.prisma.councilVerdict.update({
        where: { id: verdict.id },
        data: {
          status: CouncilVerdictStatus.FAILED,
          errorMessage: msg.slice(0, 2000),
        },
      });
    }
  }
}
