import { Injectable, Logger } from "@nestjs/common";
import {
  AbsencePayFormula,
  EmployeeEmploymentStatus,
  EmployeeKind,
  Prisma,
} from "@erafinance/database";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import {
  computeVacationBalance,
  inclusiveCalendarDays,
  utcDayStart,
} from "./vacation-balance.util";

const Decimal = Prisma.Decimal;

@Injectable()
export class VacationBalanceService {
  private readonly logger = new Logger(VacationBalanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ежедневно 01:00 Asia/Baku: пересчёт `vacationDaysBalance` для штатников в статусе ACTIVE.
   * (Nest Schedule; очередь BullMQ не требуется — объём операций умеренный.)
   */
  @Cron("0 1 * * *", { timeZone: "Asia/Baku" })
  async recalculateAllEmployeesDaily(): Promise<void> {
    const asOf = utcDayStart(new Date());
    const res = await this.recalculateBalancesAsOf(asOf);
    this.logger.log(
      `Vacation balance cron: updated ${res.updated} employee(s), asOf=${asOf.toISOString().slice(0, 10)}`,
    );
  }

  async recalculateBalancesAsOf(asOf: Date): Promise<{ updated: number }> {
    const employees = await this.prisma.employee.findMany({
      where: {
        kind: EmployeeKind.EMPLOYEE,
        employmentStatus: EmployeeEmploymentStatus.ACTIVE,
      },
      select: {
        id: true,
        hireDate: true,
        initialVacationDays: true,
        baseVacationDaysPerYear: true,
      },
    });
    if (employees.length === 0) {
      return { updated: 0 };
    }

    const ids = employees.map((e) => e.id);
    const absences = await this.prisma.absence.findMany({
      where: {
        approved: true,
        employeeId: { in: ids },
        absenceType: { formula: AbsencePayFormula.LABOR_LEAVE_304 },
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true,
      },
    });

    const usedByEmployee = new Map<string, InstanceType<typeof Decimal>>();
    for (const a of absences) {
      const days = new Decimal(
        inclusiveCalendarDays(a.startDate, a.endDate),
      );
      const cur = usedByEmployee.get(a.employeeId) ?? new Decimal(0);
      usedByEmployee.set(a.employeeId, cur.add(days));
    }

    let updated = 0;
    const chunkSize = 50;
    for (let i = 0; i < employees.length; i += chunkSize) {
      const slice = employees.slice(i, i + chunkSize);
      await this.prisma.$transaction(
        slice.map((emp) => {
          const used = usedByEmployee.get(emp.id) ?? new Decimal(0);
          const balance = computeVacationBalance({
            hireDate: emp.hireDate,
            asOf,
            initialVacationDays: new Decimal(emp.initialVacationDays),
            baseVacationDaysPerYear: emp.baseVacationDaysPerYear,
            usedLaborLeaveDays: used,
          });
          return this.prisma.employee.update({
            where: { id: emp.id },
            data: { vacationDaysBalance: balance },
          });
        }),
      );
      updated += slice.length;
    }

    return { updated };
  }
}
