import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { BackdatingQueryDto } from "./dto/backdating-query.dto";

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function calendarDaysBetween(documentDate: Date, createdAt: Date): number {
  const a = startOfUtcDay(documentDate).getTime();
  const b = startOfUtcDay(createdAt).getTime();
  return Math.floor((b - a) / 86_400_000);
}

@Injectable()
export class AuditHubBackdatingService {
  constructor(private readonly prisma: PrismaService) {}

  async report(organizationId: string, query: BackdatingQueryDto) {
    const thresholdDays = query.thresholdDays ?? 1;
    const types = (query.entityTypes ?? "invoice,transaction")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

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

    const rows: Array<{
      entityType: string;
      entityId: string;
      label: string;
      documentDate: string;
      createdAt: string;
      deltaDays: number;
    }> = [];

    if (types.includes("invoice")) {
      const invoices = await this.prisma.invoice.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...createdFilter,
        },
        select: {
          id: true,
          number: true,
          dueDate: true,
          createdAt: true,
        },
        take: 2000,
      });
      for (const inv of invoices) {
        const delta = calendarDaysBetween(inv.dueDate, inv.createdAt);
        if (delta > thresholdDays) {
          rows.push({
            entityType: "invoice",
            entityId: inv.id,
            label: inv.number,
            documentDate: inv.dueDate.toISOString().slice(0, 10),
            createdAt: inv.createdAt.toISOString(),
            deltaDays: delta,
          });
        }
      }
    }

    if (types.includes("transaction")) {
      const txs = await this.prisma.transaction.findMany({
        where: {
          organizationId,
          ...createdFilter,
        },
        select: {
          id: true,
          date: true,
          createdAt: true,
          reference: true,
        },
        take: 5000,
      });
      for (const tx of txs) {
        const delta = calendarDaysBetween(tx.date, tx.createdAt);
        if (delta > thresholdDays) {
          rows.push({
            entityType: "transaction",
            entityId: tx.id,
            label: tx.reference ?? tx.id,
            documentDate: tx.date.toISOString().slice(0, 10),
            createdAt: tx.createdAt.toISOString(),
            deltaDays: delta,
          });
        }
      }
    }

    rows.sort((a, b) => b.deltaDays - a.deltaDays);
    return { items: rows };
  }
}
