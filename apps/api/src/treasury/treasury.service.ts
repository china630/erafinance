import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CounterpartyRole,
  InvoiceStatus,
  LedgerType,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_CASH_FLOW_ITEMS: { code: string; name: string }[] = [
  { code: "CF-OPS", name: "Əməliyyat fəaliyyəti üzrə ödənişlər" },
  { code: "CF-SUP", name: "Təchizatçılara ödənişlər" },
  { code: "CF-SAL", name: "Əmək haqqı ödənişləri" },
  { code: "CF-TAX", name: "Vergi və məcburi ödənişlər" },
  { code: "CF-OTH", name: "Digər pul axını" },
];

@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Список статей ДДС; при пустом справочнике создаёт типовой набор.
   */
  async listOrSeedCashFlowItems(organizationId: string) {
    const existing = await this.prisma.cashFlowItem.findMany({
      where: { organizationId },
      orderBy: [{ code: "asc" }],
    });
    if (existing.length > 0) return existing;

    await this.prisma.$transaction(
      DEFAULT_CASH_FLOW_ITEMS.map((d) =>
        this.prisma.cashFlowItem.create({
          data: {
            organizationId,
            code: d.code,
            name: d.name,
          },
        }),
      ),
    );

    return this.prisma.cashFlowItem.findMany({
      where: { organizationId },
      orderBy: [{ code: "asc" }],
    });
  }

  async createCashFlowItem(
    organizationId: string,
    code: string,
    name: string,
  ) {
    const c = code.trim();
    const n = name.trim();
    if (!c || !n) {
      throw new BadRequestException("code and name required");
    }
    return this.prisma.cashFlowItem.create({
      data: { organizationId, code: c, name: n },
    });
  }

  listCashDesks(organizationId: string) {
    return this.prisma.cashDesk.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ name: "asc" }],
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, finCode: true },
        },
      },
    });
  }

  async createCashDesk(
    organizationId: string,
    dto: { name: string; employeeId?: string | null; currencies?: string[] },
  ) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("name required");
    return this.prisma.cashDesk.create({
      data: {
        organizationId,
        name,
        employeeId: dto.employeeId?.trim() || null,
        currencies: dto.currencies?.length ? dto.currencies : [],
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, finCode: true },
        },
      },
    });
  }

  async assertCashFlowItem(organizationId: string, id: string) {
    const row = await this.prisma.cashFlowItem.findFirst({
      where: { id, organizationId },
    });
    if (!row) {
      throw new BadRequestException("cashFlowItemId not found for organization");
    }
    return row;
  }

  async assertCashDesk(organizationId: string, id: string) {
    const row = await this.prisma.cashDesk.findFirst({
      where: { id, organizationId, isActive: true },
    });
    if (!row) {
      throw new BadRequestException("cashDeskId not found for organization");
    }
    return row;
  }

  async getCashflowProjection(organizationId: string, horizonDays = 30) {
    const days = Number.isFinite(horizonDays)
      ? Math.min(Math.max(Math.trunc(horizonDays), 1), 180)
      : 30;
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + (days - 1));

    const bankAccounts = await this.prisma.organizationBankAccount.findMany({
      where: { organizationId, isArchived: false },
      select: { id: true, ledgerAccountCode: true },
    });

    const ledgerCodes = Array.from(
      new Set(bankAccounts.map((a) => a.ledgerAccountCode).filter((x) => x.trim() !== "")),
    );
    const nasAccounts = await this.prisma.account.findMany({
      where: { organizationId, ledgerType: LedgerType.NAS, code: { in: ledgerCodes } },
      select: { id: true, code: true },
    });
    const accountIds = nasAccounts.map((a) => a.id);
    const balances = accountIds.length
      ? await this.prisma.accountBalance.findMany({
          where: {
            organizationId,
            ledgerType: LedgerType.NAS,
            accountId: { in: accountIds },
          },
          orderBy: [{ balanceDate: "desc" }],
          select: { accountId: true, debitBalance: true, creditBalance: true, balanceDate: true },
        })
      : [];

    const seen = new Set<string>();
    let currentBalance = new Prisma.Decimal(0);
    for (const b of balances) {
      if (seen.has(b.accountId)) continue;
      seen.add(b.accountId);
      currentBalance = currentBalance.add(
        new Prisma.Decimal(b.debitBalance).sub(new Prisma.Decimal(b.creditBalance)),
      );
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        dueDate: { gte: start, lte: end },
        status: {
          in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID],
        },
      },
      select: {
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        debitAccountCode: true,
        counterparty: { select: { role: true } },
      },
    });

    const byDate = new Map<string, { inflow: Prisma.Decimal; outflow: Prisma.Decimal }>();
    for (const inv of invoices) {
      const openAmount = new Prisma.Decimal(inv.totalAmount).sub(
        new Prisma.Decimal(inv.paidAmount ?? 0),
      );
      if (openAmount.lte(0)) continue;
      const key = inv.dueDate.toISOString().slice(0, 10);
      const agg = byDate.get(key) ?? {
        inflow: new Prisma.Decimal(0),
        outflow: new Prisma.Decimal(0),
      };
      const role = inv.counterparty.role;
      const treatAsOutflow =
        role === CounterpartyRole.SUPPLIER ||
        (role === CounterpartyRole.BOTH && !inv.debitAccountCode.startsWith("1"));
      if (treatAsOutflow) agg.outflow = agg.outflow.add(openAmount);
      else agg.inflow = agg.inflow.add(openAmount);
      byDate.set(key, agg);
    }

    const rows: Array<{
      date: string;
      projectedBalance: string;
      inflow: string;
      outflow: string;
    }> = [];
    let running = currentBalance;
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      const key = date.toISOString().slice(0, 10);
      const io = byDate.get(key) ?? {
        inflow: new Prisma.Decimal(0),
        outflow: new Prisma.Decimal(0),
      };
      running = running.add(io.inflow).sub(io.outflow);
      rows.push({
        date: key,
        inflow: io.inflow.toFixed(2),
        outflow: io.outflow.toFixed(2),
        projectedBalance: running.toFixed(2),
      });
    }

    return {
      currency: "AZN",
      horizonDays: days,
      openingBalance: currentBalance.toFixed(2),
      points: rows,
    };
  }
}
