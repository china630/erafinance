import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateAuditSampleDto } from "./dto/create-audit-sample.dto";

type DocumentRef = { entityType: string; entityId: string };

function seedToMulberry32(seed: string): () => number {
  let a = 0;
  for (let i = 0; i < seed.length; i++) {
    a = (Math.imul(31, a) + seed.charCodeAt(i)) | 0;
  }
  a = a >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rnd: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

@Injectable()
export class AuditSamplingService {
  constructor(private readonly prisma: PrismaService) {}

  async createSample(
    organizationId: string,
    createdByUserId: string,
    dto: CreateAuditSampleDto,
  ) {
    const periodFrom = new Date(dto.periodFrom);
    const periodTo = new Date(dto.periodTo);
    if (Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) {
      throw new BadRequestException({ code: "INVALID_PERIOD" });
    }
    if (periodFrom.getTime() > periodTo.getTime()) {
      throw new BadRequestException({ code: "PERIOD_ORDER" });
    }
    if (
      dto.mode === "materiality" &&
      dto.scope !== "sales_invoices"
    ) {
      throw new BadRequestException({
        code: "MATERIALITY_SCOPE",
        message:
          "Materiality mode is only supported for scope sales_invoices.",
      });
    }

    const periodFromStart = new Date(periodFrom);
    periodFromStart.setUTCHours(0, 0, 0, 0);
    const periodToEnd = new Date(periodTo);
    periodToEnd.setUTCHours(23, 59, 59, 999);

    const seed = dto.seed ?? randomUUID();
    const rnd = seedToMulberry32(seed);

    let refs: DocumentRef[] = [];

    if (dto.scope === "sales_invoices") {
      const rows = await this.prisma.invoice.findMany({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: periodFromStart, lte: periodToEnd },
        },
        select: { id: true, totalAmount: true, currency: true },
        take: 10_000,
      });
      let pool = rows;
      if (dto.mode === "materiality") {
        const thr = dto.thresholdAmount ?? 0;
        const cur = dto.currency ?? "AZN";
        pool = rows.filter(
          (r) =>
            r.currency === cur && Math.abs(Number(r.totalAmount)) >= thr,
        );
      }
      const ids = pool.map((r) => r.id);
      if (dto.mode === "random") {
        const pct = dto.percent ?? 5;
        const shuffled = [...ids];
        shuffleInPlace(shuffled, rnd);
        const n = Math.max(1, Math.ceil((shuffled.length * pct) / 100));
        refs = shuffled.slice(0, n).map((id) => ({
          entityType: "invoice",
          entityId: id,
        }));
      } else {
        refs = ids.map((id) => ({ entityType: "invoice", entityId: id }));
      }
    } else if (dto.scope === "transactions") {
      const rows = await this.prisma.transaction.findMany({
        where: {
          organizationId,
          date: { gte: periodFromStart, lte: periodToEnd },
        },
        select: { id: true },
        take: 10_000,
      });
      const ids = rows.map((r) => r.id);
      if (dto.mode === "random") {
        const pct = dto.percent ?? 5;
        const shuffled = [...ids];
        shuffleInPlace(shuffled, rnd);
        const n = Math.max(1, Math.ceil((shuffled.length * pct) / 100));
        refs = shuffled.slice(0, n).map((id) => ({
          entityType: "transaction",
          entityId: id,
        }));
      } else {
        refs = ids.map((id) => ({ entityType: "transaction", entityId: id }));
      }
    } else if (dto.scope === "customs_declarations") {
      const rows = await this.prisma.customsDeclaration.findMany({
        where: {
          organizationId,
          createdAt: { gte: periodFromStart, lte: periodToEnd },
        },
        select: { id: true },
        take: 5000,
      });
      const ids = rows.map((r) => r.id);
      if (dto.mode === "random") {
        const pct = dto.percent ?? 5;
        const shuffled = [...ids];
        shuffleInPlace(shuffled, rnd);
        const n = Math.max(1, Math.ceil((shuffled.length * pct) / 100));
        refs = shuffled.slice(0, n).map((id) => ({
          entityType: "customs_declaration",
          entityId: id,
        }));
      } else {
        refs = ids.map((id) => ({
          entityType: "customs_declaration",
          entityId: id,
        }));
      }
    } else if (dto.scope === "ocr_jobs") {
      const rows = await this.prisma.ocrJob.findMany({
        where: {
          organizationId,
          createdAt: { gte: periodFromStart, lte: periodToEnd },
        },
        select: { id: true },
        take: 5000,
      });
      const ids = rows.map((r) => r.id);
      if (dto.mode === "random") {
        const pct = dto.percent ?? 5;
        const shuffled = [...ids];
        shuffleInPlace(shuffled, rnd);
        const n = Math.max(1, Math.ceil((shuffled.length * pct) / 100));
        refs = shuffled.slice(0, n).map((id) => ({
          entityType: "ocr_job",
          entityId: id,
        }));
      } else {
        refs = ids.map((id) => ({ entityType: "ocr_job", entityId: id }));
      }
    }

    const row = await this.prisma.auditSample.create({
      data: {
        organizationId,
        createdByUserId,
        scope: dto.scope,
        mode: dto.mode,
        params: {
          periodFrom: dto.periodFrom,
          periodTo: dto.periodTo,
          percent: dto.percent ?? null,
          thresholdAmount: dto.thresholdAmount ?? null,
          currency: dto.currency ?? "AZN",
        },
        documentRefs: refs as object,
        seed,
      },
    });

    return {
      id: row.id,
      scope: row.scope,
      mode: row.mode,
      seed: row.seed,
      count: refs.length,
      documentRefs: refs,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getSample(organizationId: string, id: string) {
    const row = await this.prisma.auditSample.findFirst({
      where: { id, organizationId },
    });
    if (!row) {
      throw new NotFoundException({ code: "SAMPLE_NOT_FOUND" });
    }
    return {
      id: row.id,
      scope: row.scope,
      mode: row.mode,
      params: row.params,
      seed: row.seed,
      documentRefs: row.documentRefs,
      createdAt: row.createdAt.toISOString(),
      createdByUserId: row.createdByUserId,
    };
  }
}
