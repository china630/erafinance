import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

type RawClient = Pick<PrismaService, "$executeRawUnsafe">;

@Injectable()
export class IntegrationSyncRunService {
  constructor(private readonly prisma: PrismaService) {}

  async start(
    params: {
      organizationId: string;
      portal: "DVX" | "EMAS" | "CUSTOMS";
      flow: string;
      transport: "RPA_WIDGET" | "EXCEL_IMPORT";
      totalCount: number;
      triggeredByUserId?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const runId = randomUUID();
    const db = (tx ?? this.prisma) as RawClient;
    await db.$executeRawUnsafe(
      `INSERT INTO integration_sync_runs
        (id, organization_id, portal, flow, transport, total_count, triggered_by_user_id)
       VALUES ($1::uuid, $2::uuid, $3::"IntegrationPortal", $4, $5::"IntegrationTransport", $6, $7::uuid)`,
      runId,
      params.organizationId,
      params.portal,
      params.flow,
      params.transport,
      params.totalCount,
      params.triggeredByUserId ?? null,
    );
    return runId;
  }

  async complete(
    params: {
      runId: string;
      successCount: number;
      errorCount: number;
      notes?: unknown;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = (tx ?? this.prisma) as RawClient;
    await db.$executeRawUnsafe(
      `UPDATE integration_sync_runs
       SET completed_at = NOW(),
           success_count = $2,
           error_count = $3,
           notes = $4::jsonb
       WHERE id = $1::uuid`,
      params.runId,
      params.successCount,
      params.errorCount,
      JSON.stringify(params.notes ?? {}),
    );
  }
}
