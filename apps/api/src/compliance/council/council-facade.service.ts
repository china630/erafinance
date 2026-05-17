import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeListPagination } from "../../common/list-pagination";
import { CouncilDispatcherService } from "./council-dispatcher.service";
import type { DeliberateCouncilInput } from "./council.types";

@Injectable()
export class CouncilFacadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: CouncilDispatcherService,
  ) {}

  async deliberate(
    organizationId: string,
    input: Omit<DeliberateCouncilInput, "organizationId">,
  ) {
    const { verdictId } = await this.dispatcher.deliberate({
      organizationId,
      ...input,
    });
    const row = await this.prisma.councilVerdict.findFirst({
      where: { id: verdictId, organizationId },
    });
    return {
      verdictId,
      status: row?.status ?? "QUEUED",
    };
  }

  async getVerdict(organizationId: string, id: string) {
    const row = await this.prisma.councilVerdict.findFirst({
      where: { id, organizationId },
    });
    if (!row) {
      throw new NotFoundException("Council verdict not found");
    }
    return row;
  }

  async listVerdicts(
    organizationId: string,
    q: { riskAuditId?: string; page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      q.page,
      q.pageSize,
      25,
    );
    const where: Prisma.CouncilVerdictWhereInput = { organizationId };
    if (q.riskAuditId) {
      where.riskAuditId = q.riskAuditId;
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.councilVerdict.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.councilVerdict.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
