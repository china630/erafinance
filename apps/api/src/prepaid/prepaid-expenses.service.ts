import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LedgerType,
  PrepaidExpenseScheduleStatus,
  PrepaidExpenseStatus,
} from "@erafinance/database";
import { Decimal } from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreatePrepaidExpenseDto } from "./dto/create-prepaid-expense.dto";

function utcMonthStart(y: number, m0: number): Date {
  return new Date(Date.UTC(y, m0, 1, 0, 0, 0, 0));
}

/** Inclusive calendar months between start and end (UTC), as `YYYY-MM` keys. */
export function enumerateMonthKeys(start: Date, end: Date): string[] {
  if (start.getTime() > end.getTime()) {
    return [];
  }
  const out: string[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  for (;;) {
    const cur = utcMonthStart(y, m);
    if (cur.getTime() > end.getTime()) {
      break;
    }
    out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

@Injectable()
export class PrepaidExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  list(organizationId: string) {
    return this.prisma.prepaidExpense.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        schedules: { orderBy: { period: "asc" } },
        counterparty: { select: { id: true, nameCipher: true } },
      },
    });
  }

  async create(organizationId: string, dto: CreatePrepaidExpenseDto) {
    const start = new Date(`${dto.startDate}T00:00:00.000Z`);
    const end = new Date(`${dto.endDate}T00:00:00.000Z`);
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException("endDate must be on or after startDate");
    }
    const total = new Decimal(dto.totalAmount);
    if (total.lte(0)) {
      throw new BadRequestException("totalAmount must be positive");
    }
    const months = enumerateMonthKeys(start, end);
    if (!months.length) {
      throw new BadRequestException("No months in range");
    }
    const n = months.length;
    const base = total.div(n).toDecimalPlaces(4, Decimal.ROUND_DOWN);
    const remainder = total.sub(base.mul(n));

    const currency = dto.currency?.trim() || "AZN";
    const expenseCode = dto.expenseAccountCode?.trim() || "731";
    const prepaidCode = dto.prepaidAccountCode?.trim() || "133";

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.prepaidExpense.create({
        data: {
          organizationId,
          counterpartyId: dto.counterpartyId ?? undefined,
          totalAmount: total,
          currency,
          startDate: start,
          endDate: end,
          monthlyAmount: base,
          status: PrepaidExpenseStatus.ACTIVE,
          expenseAccountCode: expenseCode,
          prepaidAccountCode: prepaidCode,
        },
      });
      for (let i = 0; i < months.length; i++) {
        const mk = months[i]!;
        const amt = i === months.length - 1 ? base.add(remainder) : base;
        await tx.prepaidExpenseSchedule.create({
          data: {
            prepaidExpenseId: row.id,
            period: mk,
            amount: amt,
            status: PrepaidExpenseScheduleStatus.PENDING,
          },
        });
      }
      return tx.prepaidExpense.findUniqueOrThrow({
        where: { id: row.id },
        include: { schedules: { orderBy: { period: "asc" } } },
      });
    });
  }

  async postMonth(params: {
    organizationId: string;
    prepaidExpenseId: string;
    period: string;
  }): Promise<{ transactionId: string }> {
    const period = params.period.trim();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException("period must be YYYY-MM");
    }
    const prepaid = await this.prisma.prepaidExpense.findFirst({
      where: { id: params.prepaidExpenseId, organizationId: params.organizationId },
      include: { schedules: true },
    });
    if (!prepaid) {
      throw new NotFoundException();
    }
    if (prepaid.status !== PrepaidExpenseStatus.ACTIVE) {
      throw new BadRequestException("Prepaid expense is not active");
    }
    const line = prepaid.schedules.find((s) => s.period === period);
    if (!line) {
      throw new NotFoundException("Schedule line not found for period");
    }
    if (line.status === PrepaidExpenseScheduleStatus.POSTED) {
      throw new BadRequestException("Period already posted");
    }
    const y = Number(period.slice(0, 4));
    const m = Number(period.slice(5, 7));
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException("Invalid period");
    }
    const bookingDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const amountStr = new Decimal(line.amount).toFixed(4);

    const { transactionId } = await this.prisma.$transaction(async (tx) => {
      const { transactionId: tid } = await this.accounting.postJournalInTransaction(tx, {
        organizationId: params.organizationId,
        date: bookingDate,
        reference: `PREPAID-${prepaid.id}-${period}`,
        description: `Prepaid amortization ${period}`,
        isFinal: true,
        counterpartyId: prepaid.counterpartyId,
        ledgerType: LedgerType.NAS,
        lines: [
          {
            accountCode: prepaid.expenseAccountCode,
            debit: amountStr,
            credit: "0",
          },
          {
            accountCode: prepaid.prepaidAccountCode,
            debit: "0",
            credit: amountStr,
          },
        ],
      });
      await tx.prepaidExpenseSchedule.update({
        where: { id: line.id },
        data: {
          status: PrepaidExpenseScheduleStatus.POSTED,
          postedTransactionId: tid,
        },
      });
      const pendingLeft = await tx.prepaidExpenseSchedule.count({
        where: {
          prepaidExpenseId: prepaid.id,
          status: PrepaidExpenseScheduleStatus.PENDING,
        },
      });
      if (pendingLeft === 0) {
        await tx.prepaidExpense.update({
          where: { id: prepaid.id },
          data: { status: PrepaidExpenseStatus.FULLY_AMORTIZED },
        });
      }
      return { transactionId: tid };
    });

    return { transactionId };
  }
}
