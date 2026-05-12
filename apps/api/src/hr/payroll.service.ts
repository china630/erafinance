import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  Decimal,
  EmployeeKind,
  PayrollRunStatus,
  UserRole,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import {
  PAYABLE_SUPPLIERS_ACCOUNT_CODE,
  PAYROLL_EXPENSE_ACCOUNT_CODE,
  PAYROLL_PAYABLE_ACCOUNT_CODE,
  PAYROLL_TAX_PAYABLE_ACCOUNT_CODE,
} from "../ledger.constants";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePayrollRunDto } from "./dto/create-payroll-run.dto";
import { PayrollHeavyQueueService } from "./payroll-heavy.queue";
import { AbsencesService } from "./absences.service";
import type { SickPayCalcDto } from "./dto/sick-pay-calc.dto";
import { TimesheetService } from "./timesheet.service";
import { PAYROLL_ENTITY_ASYNC_THRESHOLD } from "./payroll.constants";
import {
  calculateContractorMicroPayrollTax,
  calculatePayrollByTemplateGroup,
  parsePayrollTaxSettings,
} from "../payroll/tax-calculator";
import { BankingGatewayService } from "../banking/banking-gateway.service";
import { assertMayAccessPayrollFinance } from "../auth/policies/hr-payroll.policy";
import { NotificationService } from "../notifications/notification.service";
import {
  STORAGE_SERVICE,
  type StorageService,
} from "../storage/storage.interface";

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly payrollQueue: PayrollHeavyQueueService,
    private readonly timesheet: TimesheetService,
    private readonly absences: AbsencesService,
    private readonly bankingGateway: BankingGatewayService,
    private readonly config: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly notifications: NotificationService,
  ) {}

  listRuns(organizationId: string) {
    return this.prisma.payrollRun.findMany({
      where: { organizationId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { slips: true } } },
    });
  }

  listPayoutBankAccounts(organizationId: string) {
    return this.prisma.organizationBankAccount.findMany({
      where: { organizationId },
      orderBy: [{ bankName: "asc" }, { accountNumber: "asc" }],
    });
  }

  async getRun(organizationId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, organizationId },
      include: {
        slips: { include: { employee: true } },
      },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    return run;
  }

  /**
   * Синхронное создание черновика (используется worker’ом и при N ≤ порога).
   */
  async createDraftRunSync(organizationId: string, dto: CreatePayrollRunDto) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: {
        organizationId_year_month: {
          organizationId,
          year: dto.year,
          month: dto.month,
        },
      },
    });
    if (existing) {
      throw new ConflictException("Payroll run already exists for this month");
    }

    const [employees, org] = await Promise.all([
      this.prisma.employee.findMany({ where: { organizationId } }),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);
    if (employees.length === 0) {
      throw new BadRequestException("No employees to pay");
    }
    const taxSettings = parsePayrollTaxSettings(org?.settings);
    const templateGroup = this.resolveTemplateGroup(org?.settings);

    let tsSummary: Awaited<
      ReturnType<TimesheetService["summarizeForPayroll"]>
    > | null = null;
    if (dto.timesheetId) {
      tsSummary = await this.timesheet.summarizeForPayroll(
        dto.timesheetId,
        organizationId,
      );
      if (tsSummary.year !== dto.year || tsSummary.month !== dto.month) {
        throw new BadRequestException(
          "Табель не соответствует выбранному месяцу ведомости",
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          organizationId,
          year: dto.year,
          month: dto.month,
          status: PayrollRunStatus.DRAFT,
          timesheetId: dto.timesheetId ?? undefined,
        },
      });

      for (const emp of employees) {
        let grossBase = new Decimal(emp.salary);
        if (
          emp.kind === EmployeeKind.EMPLOYEE &&
          tsSummary?.mixByEmployeeId[emp.id]
        ) {
          const m = tsSummary.mixByEmployeeId[emp.id];
          grossBase = await this.absences.adjustGrossForStampedTimesheetMonth(
            organizationId,
            emp.id,
            grossBase,
            tsSummary.year,
            tsSummary.month,
            m,
          );
        }
        const b =
          emp.kind === EmployeeKind.CONTRACTOR
            ? calculateContractorMicroPayrollTax(
                new Decimal(emp.salary),
                emp.contractorMonthlySocialAzn,
              )
            : calculatePayrollByTemplateGroup(
                grossBase,
                templateGroup,
                taxSettings,
              );
        if (b.net.isNegative()) {
          throw new BadRequestException(
            `Отрицательная сумма к выплате для сотрудника ${emp.lastName}: проверьте оклад и фикс. соц. удержания`,
          );
        }
        const ts = tsSummary?.byEmployeeId[emp.id];
        await tx.payrollSlip.create({
          data: {
            organizationId,
            payrollRunId: run.id,
            employeeId: emp.id,
            gross: b.gross,
            incomeTax: b.incomeTax,
            dsmfWorker: b.dsmfWorker,
            dsmfEmployer: b.dsmfEmployer,
            itsWorker: b.itsWorker,
            itsEmployer: b.itsEmployer,
            unemploymentWorker: b.unemploymentWorker,
            unemploymentEmployer: b.unemploymentEmployer,
            contractorSocialWithheld: b.contractorSocialWithheld,
            net: b.net,
            timesheetWorkDays: ts?.work ?? null,
            timesheetVacationDays: ts?.vacation ?? null,
            timesheetSickDays: ts?.sick ?? null,
            timesheetBusinessTripDays: ts?.businessTrip ?? null,
          },
        });
      }

      return tx.payrollRun.findUniqueOrThrow({
        where: { id: run.id },
        include: {
          slips: { include: { employee: true } },
        },
      });
    });
  }

  /**
   * При большом числе сотрудников — очередь BullMQ, иначе синхронно.
   */
  async createDraftRun(
    organizationId: string,
    dto: CreatePayrollRunDto,
  ): Promise<
    | { async: true; jobId: string }
    | Awaited<ReturnType<PayrollService["createDraftRunSync"]>>
  > {
    const employees = await this.prisma.employee.findMany({
      where: { organizationId },
      select: { id: true },
    });
    if (employees.length > PAYROLL_ENTITY_ASYNC_THRESHOLD) {
      const jobId = await this.payrollQueue.enqueueDraft(organizationId, dto);
      return { async: true, jobId };
    }
    return this.createDraftRunSync(organizationId, dto);
  }

  /**
   * Переводит `PayrollRun` в **POSTED** (без проводок ГК).
   * NAS-проводки по ЗП создаются при **`SalaryRegistry → PAID`**: см. `markSalaryRegistryPaid`
   * (штат: 721/533/521; ГПХ: 721/531/521 — TZ §12.3).
   */
  async postRunSync(organizationId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, organizationId },
      include: { slips: true },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new ConflictException("Payroll run already posted");
    }
    if (run.slips.length === 0) {
      throw new BadRequestException("No slips");
    }

    await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: PayrollRunStatus.POSTED,
      },
    });

    return this.getRun(organizationId, run.id);
  }

  /**
   * При большом числе листов — очередь BullMQ.
   */
  async postRun(
    organizationId: string,
    runId: string,
  ): Promise<
    | { async: true; jobId: string }
    | Awaited<ReturnType<PayrollService["postRunSync"]>>
  > {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, organizationId },
      include: { _count: { select: { slips: true } } },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run._count.slips > PAYROLL_ENTITY_ASYNC_THRESHOLD) {
      const jobId = await this.payrollQueue.enqueuePost(organizationId, runId);
      return { async: true, jobId };
    }
    return this.postRunSync(organizationId, runId);
  }

  /**
   * TZ §7.0: xəstəlik üzrə işəgötürən hissəsi (14 günədək, staj %) — tam məntiqi `AbsencesService`.
   */
  previewSickLeavePay(organizationId: string, dto: SickPayCalcDto) {
    return this.absences.calculateSickPay(organizationId, dto);
  }

  /**
   * TZ §7.0: əmək məzuniyyəti / 30.4 — tam məntiqi `AbsencesService`.
   */
  previewLaborLeavePay(
    organizationId: string,
    employeeId: string,
    vacationStart: string,
    vacationEnd: string,
    absenceTypeId?: string,
  ) {
    return this.absences.calculateVacationPay(
      organizationId,
      employeeId,
      vacationStart,
      vacationEnd,
      absenceTypeId,
    );
  }

  async createAndPrepareSalaryRegistry(
    organizationId: string,
    payrollRunId: string,
    params: {
      bankAccountId: string;
      payoutFormat?: "ABB_XML" | "UNIVERSAL_XLSX";
    },
    actingUserRole: UserRole,
  ) {
    assertMayAccessPayrollFinance(actingUserRole);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, organizationId },
      include: { slips: true },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== PayrollRunStatus.POSTED) {
      throw new BadRequestException("Payroll run must be POSTED before payout");
    }
    const bankAccount = await this.prisma.organizationBankAccount.findFirst({
      where: { id: params.bankAccountId, organizationId },
    });
    if (!bankAccount) throw new BadRequestException("Bank account not found");
    const payoutFormat =
      params.payoutFormat ??
      (bankAccount.bankName.toLowerCase().includes("abb")
        ? "ABB_XML"
        : "UNIVERSAL_XLSX");

    const created = await (this.prisma as any).salaryRegistry.create({
      data: {
        organizationId,
        payrollRunId,
        bankAccountId: bankAccount.id,
        payoutFormat,
        status: "DRAFT",
      },
    });
    const prepared = await this.bankingGateway.prepareSalaryRegistry(
      created.id,
      actingUserRole,
    );
    return prepared;
  }

  listRunSalaryRegistries(organizationId: string, payrollRunId: string) {
    return (this.prisma as any).salaryRegistry.findMany({
      where: { organizationId, payrollRunId },
      include: { bankAccount: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async markSalaryRegistryPaid(organizationId: string, registryId: string) {
    const row = await (this.prisma as any).salaryRegistry.findFirst({
      where: { id: registryId, organizationId },
      include: {
        payrollRun: {
          include: {
            slips: {
              include: {
                employee: {
                  select: {
                    kind: true,
                    jobPosition: { select: { departmentId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Salary registry not found");
    if (row.status !== "SENT") {
      throw new BadRequestException("Only SENT registry can be marked as PAID");
    }

    const run = row.payrollRun as
      | {
          id: string;
          year: number;
          month: number;
          status: PayrollRunStatus;
          transactionId: string | null;
          slips: Array<{
            gross: Decimal;
            net: Decimal;
            incomeTax: Decimal;
            dsmfWorker: Decimal;
            itsWorker: Decimal;
            unemploymentWorker: Decimal;
            contractorSocialWithheld: Decimal;
            dsmfEmployer: Decimal;
            itsEmployer: Decimal;
            unemploymentEmployer: Decimal;
            employee: {
              kind: EmployeeKind;
              jobPosition: { departmentId: string | null } | null;
            };
          }>;
        }
      | undefined;
    if (!run) throw new BadRequestException("Payroll run not found for registry");
    if (run.status !== PayrollRunStatus.POSTED) {
      throw new BadRequestException("Payroll run must be POSTED before registry PAID");
    }

    const periodEnd = new Date(Date.UTC(run.year, run.month, 0, 12, 0, 0, 0));
    const refBase = `PAY-${run.year}-${String(run.month).padStart(2, "0")}`;

    const updatedRegistry = await this.prisma.$transaction(async (tx) => {
      /** First created GL transaction id when multiple departmental postings exist (backward-compatible link on PayrollRun). */
      let runTransactionId = run.transactionId;
      if (!runTransactionId) {
        type EmpBucket = {
          gross: Decimal;
          net: Decimal;
          workerTaxes: Decimal;
          employer: Decimal;
        };
        type ContrBucket = {
          gross: Decimal;
          withholding521: Decimal;
        };
        const emptyEmp = (): EmpBucket => ({
          gross: new Decimal(0),
          net: new Decimal(0),
          workerTaxes: new Decimal(0),
          employer: new Decimal(0),
        });
        const emptyContr = (): ContrBucket => ({
          gross: new Decimal(0),
          withholding521: new Decimal(0),
        });

        const buckets = new Map<
          string,
          {
            departmentId: string | null;
            emp: EmpBucket;
            contr: ContrBucket;
          }
        >();

        for (const s of run.slips) {
          const departmentId =
            s.employee.jobPosition?.departmentId ?? null;
          const key = departmentId ?? "__NO_DEPARTMENT__";
          const cur = buckets.get(key) ?? {
            departmentId,
            emp: emptyEmp(),
            contr: emptyContr(),
          };

          if (s.employee.kind === EmployeeKind.CONTRACTOR) {
            cur.contr.gross = cur.contr.gross.add(s.gross);
            cur.contr.withholding521 = cur.contr.withholding521
              .add(s.incomeTax)
              .add(s.contractorSocialWithheld);
          } else {
            cur.emp.gross = cur.emp.gross.add(s.gross);
            cur.emp.net = cur.emp.net.add(s.net);
            cur.emp.workerTaxes = cur.emp.workerTaxes
              .add(s.incomeTax)
              .add(s.dsmfWorker)
              .add(s.itsWorker)
              .add(s.unemploymentWorker)
              .add(s.contractorSocialWithheld);
            cur.emp.employer = cur.emp.employer
              .add(s.dsmfEmployer)
              .add(s.itsEmployer)
              .add(s.unemploymentEmployer);
          }
          buckets.set(key, cur);
        }

        const ordered = [...buckets.values()].sort((a, b) =>
          (a.departmentId ?? "").localeCompare(b.departmentId ?? ""),
        );
        const distinctDeptIds = [
          ...new Set(
            ordered
              .map((b) => b.departmentId)
              .filter((id): id is string => id != null && id !== ""),
          ),
        ];
        const departments =
          distinctDeptIds.length > 0
            ? await tx.department.findMany({
                where: { organizationId, id: { in: distinctDeptIds } },
                select: { id: true, name: true },
              })
            : [];
        const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

        for (const [idx, b] of ordered.entries()) {
          const { emp, contr } = b;
          const cr521 = emp.workerTaxes
            .add(emp.employer)
            .add(contr.withholding521);
          const debit721 = emp.gross.add(emp.employer).add(contr.gross);
          if (debit721.isZero()) {
            continue;
          }
          const deptLabel = b.departmentId
            ? (deptNameById.get(b.departmentId) ?? b.departmentId)
            : "без подразделения";

          const lines: Array<{
            accountCode: string;
            debit: string | number;
            credit: string | number;
          }> = [];

          if (emp.gross.gt(0)) {
            lines.push({
              accountCode: PAYROLL_EXPENSE_ACCOUNT_CODE,
              debit: emp.gross.toString(),
              credit: 0,
            });
          }
          if (emp.employer.gt(0)) {
            lines.push({
              accountCode: PAYROLL_EXPENSE_ACCOUNT_CODE,
              debit: emp.employer.toString(),
              credit: 0,
            });
          }
          if (contr.gross.gt(0)) {
            lines.push({
              accountCode: PAYROLL_EXPENSE_ACCOUNT_CODE,
              debit: contr.gross.toString(),
              credit: 0,
            });
          }
          if (emp.net.gt(0)) {
            lines.push({
              accountCode: PAYROLL_PAYABLE_ACCOUNT_CODE,
              debit: 0,
              credit: emp.net.toString(),
            });
          }
          if (contr.gross.gt(0)) {
            lines.push({
              accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
              debit: 0,
              credit: contr.gross.toString(),
            });
          }
          if (contr.withholding521.gt(0)) {
            lines.push({
              accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
              debit: contr.withholding521.toString(),
              credit: 0,
            });
          }
          if (cr521.gt(0)) {
            lines.push({
              accountCode: PAYROLL_TAX_PAYABLE_ACCOUNT_CODE,
              debit: 0,
              credit: cr521.toString(),
            });
          }

          const { transactionId } = await this.accounting.postJournalInTransaction(
            tx,
            {
              organizationId,
              date: periodEnd,
              reference: `${refBase}-D${String(idx + 1).padStart(2, "0")}`,
              description: `Зарплата ${run.month}/${run.year} — ${deptLabel}`,
              isFinal: true,
              departmentId: b.departmentId ?? undefined,
              lines,
            },
          );
          if (!runTransactionId) {
            runTransactionId = transactionId;
          }
        }
      }

      await tx.payrollRun.update({
        where: { id: run.id },
        data: { transactionId: runTransactionId ?? undefined },
      });
      return (tx as any).salaryRegistry.update({
        where: { id: registryId },
        data: { status: "PAID" },
      });
    });

    await this.notifications.notifyFinanceUsers(organizationId, {
      title: "Зарплата",
      message:
        "Расчёт зарплаты завершён. Нажмите, чтобы посмотреть ведомость.",
      link: `/payroll?registryId=${registryId}`,
    });

    return updatedRegistry;
  }

  async createSalaryRegistryExportLink(
    organizationId: string,
    registryId: string,
    ttlSec = 900,
  ): Promise<{ url: string; expiresAt: string }> {
    const row = await (this.prisma as any).salaryRegistry.findFirst({
      where: { id: registryId, organizationId },
      select: { id: true, exportUrl: true },
    });
    if (!row?.exportUrl) {
      throw new NotFoundException("Export file is not ready");
    }
    const exp = Math.floor(Date.now() / 1000) + Math.max(60, ttlSec);
    const payload = `${organizationId}.${registryId}.${exp}`;
    const sig = this.signPayload(payload);
    return {
      url: `/api/hr/payroll/registries/${registryId}/export?exp=${exp}&sig=${sig}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async loadSalaryRegistryExportFile(
    organizationId: string,
    registryId: string,
    expRaw: string,
    sig: string,
  ): Promise<{ key: string; buffer: Buffer }> {
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException("Export link expired");
    }
    const payload = `${organizationId}.${registryId}.${exp}`;
    this.verifySignature(payload, sig);
    const row = await (this.prisma as any).salaryRegistry.findFirst({
      where: { id: registryId, organizationId },
      select: { exportUrl: true },
    });
    if (!row?.exportUrl) {
      throw new NotFoundException("Export file is not ready");
    }
    const buffer = await this.storage.getObject(row.exportUrl);
    return { key: row.exportUrl, buffer };
  }

  private resolveTemplateGroup(
    settingsRaw: unknown,
  ): "COMMERCIAL" | "GOVERNMENT" {
    const settings =
      settingsRaw && typeof settingsRaw === "object" && !Array.isArray(settingsRaw)
        ? (settingsRaw as Record<string, unknown>)
        : {};
    const direct = settings.templateGroup;
    if (direct === "GOVERNMENT" || direct === "COMMERCIAL") {
      return direct;
    }
    if (direct === "SMALL_BUSINESS") {
      return "COMMERCIAL";
    }
    const orgType = settings.organizationType;
    if (orgType === "GOVERNMENT") return "GOVERNMENT";
    return "COMMERCIAL";
  }

  private signPayload(payload: string): string {
    const secret =
      this.config.get<string>("PAYROLL_EXPORT_SIGN_SECRET") ||
      this.config.get<string>("JWT_SECRET") ||
      "payroll-export-dev-secret";
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  private verifySignature(payload: string, sig: string): void {
    const expected = this.signPayload(payload);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException("Invalid export signature");
    }
  }
}
