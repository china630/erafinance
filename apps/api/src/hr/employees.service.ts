import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EmployeeEmploymentStatus,
  EmployeeKind,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationSyncRunService } from "../integrations/integration-sync-run.service";
import { BulkSyncResultEmployeesDto } from "./dto/bulk-sync-result-employees.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import {
  blindIndex,
  decryptText,
  encryptText,
  normalizeFin,
  normalizeName,
  normalizeVoen,
  placeholderEmployeeFin,
  placeholderEmployeeFirstName,
  placeholderEmployeeLastName,
} from "../security/pii-crypto.util";

const Decimal = Prisma.Decimal;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncRuns: IntegrationSyncRunService,
  ) {}

  list(
    organizationId: string,
    query?: { page?: number; pageSize?: number; departmentId?: string },
  ) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, query?.pageSize ?? 20));
    const where = {
      organizationId,
      ...(query?.departmentId
        ? { jobPosition: { departmentId: query.departmentId } }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.employee.count({ where });
      const items = await tx.employee.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          jobPosition: {
            include: { department: { select: { id: true, name: true } } },
          },
        },
      });
      return { items, total, page, pageSize };
    });
  }

  private async assertPositionSlotAvailableTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    positionId: string,
    excludeEmployeeId?: string,
  ) {
    const pos = await tx.jobPosition.findFirst({
      where: { id: positionId, department: { organizationId } },
    });
    if (!pos) {
      throw new BadRequestException("Указанная должность не найдена в организации");
    }
    const cnt = await tx.employee.count({
      where: {
        organizationId,
        positionId,
        employmentStatus: EmployeeEmploymentStatus.ACTIVE,
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      },
    });
    if (cnt >= pos.totalSlots) {
      throw new HttpException({
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: "QUOTA_EXCEEDED",
        message: "Штатный лимит по этой должности исчерпан",
        limit: pos.totalSlots,
        current: cnt,
      }, HttpStatus.PAYMENT_REQUIRED);
    }
  }

  private static readonly hireGateTxOptions = {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,
    timeout: 15000,
  } as const;

  async create(organizationId: string, dto: CreateEmployeeDto) {
    const kind = dto.kind ?? EmployeeKind.EMPLOYEE;
    if (kind === EmployeeKind.CONTRACTOR && !dto.voen?.trim()) {
      throw new BadRequestException("Для подрядчика (CONTRACTOR) укажите VÖEN (10 цифр)");
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.assertPositionSlotAvailableTx(
            tx,
            organizationId,
            dto.positionId,
          );
          const finCode = dto.finCode.trim();
          const voenRaw =
            kind === EmployeeKind.CONTRACTOR
              ? dto.voen!.trim()
              : (dto.voen?.trim() ?? null);
          const firstName = dto.firstName.trim();
          const lastName = dto.lastName.trim();
          const createData: Record<string, unknown> = {
            organizationId,
            kind,
            finCode: placeholderEmployeeFin(finCode),
            finCodeBlindIndex: blindIndex("fin", normalizeFin(finCode)),
            finCodeCipher: encryptText(normalizeFin(finCode)),
            voenBlindIndex: voenRaw ? blindIndex("voen", normalizeVoen(voenRaw)) : null,
            voenCipher: voenRaw ? encryptText(normalizeVoen(voenRaw)) : null,
            firstName: placeholderEmployeeFirstName(firstName),
            firstNameCipher: encryptText(normalizeName(firstName)),
            lastName: placeholderEmployeeLastName(lastName),
            lastNameCipher: encryptText(normalizeName(lastName)),
            patronymic: dto.patronymic.trim(),
            positionId: dto.positionId,
            startDate: new Date(dto.startDate),
            hireDate: new Date(dto.hireDate),
            salary: new Decimal(dto.salary),
            initialVacationDays: new Decimal(dto.initialVacationDays ?? 0),
            avgMonthlySalaryLastYear:
              dto.avgMonthlySalaryLastYear != null
                ? new Decimal(dto.avgMonthlySalaryLastYear)
                : null,
            initialSalaryBalance: new Decimal(dto.initialSalaryBalance ?? 0),
            contractorMonthlySocialAzn:
              kind === EmployeeKind.CONTRACTOR &&
              dto.contractorMonthlySocialAzn != null
                ? new Decimal(dto.contractorMonthlySocialAzn)
                : null,
          };
          return tx.employee.create({
            data: createData as Prisma.EmployeeUncheckedCreateInput,
            include: {
              jobPosition: {
                include: { department: { select: { id: true, name: true } } },
              },
            },
          });
        },
        EmployeesService.hireGateTxOptions,
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = `${e.meta?.target ?? ""}`;
        if (target.includes("employees_org_fin_blind_uidx")) {
          throw new ConflictException("ФИН уже занят в организации");
        }
        throw new ConflictException("ФИН уже занят в организации");
      }
      throw e;
    }
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.employee.findFirst({
      where: { id, organizationId },
      include: {
        jobPosition: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException("Employee not found");
    return row;
  }

  /** Minimal DTO for ERA Finance Assistant (ƏMAS e-müqavilə prefill). */
  async getExtensionPrefill(organizationId: string, id: string) {
    const row = await this.getOne(organizationId, id);
    const start = row.startDate.toISOString().slice(0, 10);
    return {
      employeeId: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      finCode: row.finCode,
      positionTitle: row.jobPosition.name,
      departmentName: row.jobPosition.department?.name ?? null,
      salaryGrossAzn: row.salary.toFixed(2),
      contractStartDate: start,
      contractEndDate: null as string | null,
      contractId: row.id,
    };
  }

  async getExtensionPrefillBulk(organizationId: string, employeeIds: string[]) {
    const normalized = Array.from(new Set(employeeIds.map((id) => id.trim()).filter(Boolean)));
    const items = await Promise.all(
      normalized.map(async (employeeId) => ({
        employeeId,
        data: await this.getExtensionPrefill(organizationId, employeeId),
      })),
    );
    const runId = await this.syncRuns.start({
      organizationId,
      portal: "EMAS",
      flow: "emuqavile",
      transport: "RPA_WIDGET",
      totalCount: items.length,
    });
    return { runId, items };
  }

  async saveBulkSyncResult(
    organizationId: string,
    dto: BulkSyncResultEmployeesDto,
    triggeredByUserId?: string,
  ) {
    const syncedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.employee.updateMany({
          where: { organizationId, id: item.employeeId },
          data: {
            emasSyncStatus: item.status,
            emasSyncedAt: item.status === "SYNCED" ? syncedAt : null,
            emasSyncError: item.error ?? null,
            emasExternalId: item.externalId ?? null,
          } as never,
        });
      }
    });

    const successCount = dto.items.filter((it) => it.status === "SYNCED").length;
    const errorCount = dto.items.length - successCount;
    try {
      await this.syncRuns.complete({
        runId: dto.runId,
        successCount,
        errorCount,
        notes: { triggeredByUserId: triggeredByUserId ?? null },
      });
    } catch {
      const runId = await this.syncRuns.start({
        organizationId,
        portal: "EMAS",
        flow: "emuqavile",
        transport: "RPA_WIDGET",
        totalCount: dto.items.length,
        triggeredByUserId,
      });
      await this.syncRuns.complete({ runId, successCount, errorCount });
    }

    return { ok: true, successCount, errorCount };
  }

  async update(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    const current = await this.getOne(organizationId, id);
    const kind = dto.kind ?? current.kind;
    if (kind === EmployeeKind.CONTRACTOR) {
      const voen =
        dto.voen?.trim() ??
        ((current as { voenCipher?: string | null }).voenCipher
          ? (decryptText((current as { voenCipher?: string | null }).voenCipher ?? "")?.trim() ?? "")
          : "");
      if (!/^\d{10}$/.test(voen)) {
        throw new BadRequestException("Для подрядчика укажите VÖEN (10 цифр)");
      }
    }
    const data: Record<string, unknown> = {};
    if (dto.kind != null) data.kind = dto.kind;
    if (dto.finCode != null) {
      const fin = dto.finCode.trim();
      data.finCode = placeholderEmployeeFin(fin);
      data.finCodeBlindIndex = blindIndex("fin", normalizeFin(fin));
      data.finCodeCipher = encryptText(normalizeFin(fin));
    }
    if (dto.firstName != null) {
      const firstName = dto.firstName.trim();
      data.firstName = placeholderEmployeeFirstName(firstName);
      data.firstNameCipher = encryptText(normalizeName(firstName));
    }
    if (dto.lastName != null) {
      const lastName = dto.lastName.trim();
      data.lastName = placeholderEmployeeLastName(lastName);
      data.lastNameCipher = encryptText(normalizeName(lastName));
    }
    if (dto.patronymic !== undefined) {
      const p = dto.patronymic.trim();
      data.patronymic = p.length ? p : null;
    }
    if (dto.positionId != null) data.positionId = dto.positionId;
    if (dto.startDate != null) data.startDate = new Date(dto.startDate);
    if (dto.hireDate != null) data.hireDate = new Date(dto.hireDate);
    if (dto.salary != null) data.salary = new Decimal(dto.salary);
    if (dto.voen !== undefined) {
      const voen = dto.voen.trim() || null;
      data.voenBlindIndex = voen ? blindIndex("voen", normalizeVoen(voen)) : null;
      data.voenCipher = voen ? encryptText(normalizeVoen(voen)) : null;
    }
    if (dto.contractorMonthlySocialAzn !== undefined) {
      data.contractorMonthlySocialAzn =
        dto.contractorMonthlySocialAzn == null
          ? null
          : new Decimal(dto.contractorMonthlySocialAzn);
    }
    if (dto.initialSalaryBalance !== undefined) {
      data.initialSalaryBalance =
        dto.initialSalaryBalance == null
          ? new Decimal(0)
          : new Decimal(dto.initialSalaryBalance);
    }
    if (dto.initialVacationDays !== undefined) {
      data.initialVacationDays =
        dto.initialVacationDays == null
          ? new Decimal(0)
          : new Decimal(dto.initialVacationDays);
    }
    if (dto.avgMonthlySalaryLastYear !== undefined) {
      data.avgMonthlySalaryLastYear =
        dto.avgMonthlySalaryLastYear == null
          ? null
          : new Decimal(dto.avgMonthlySalaryLastYear);
    }
    if (dto.accountableAccountCode244 !== undefined) {
      const v = dto.accountableAccountCode244?.trim();
      data.accountableAccountCode244 = v ? v : null;
    }
    const nextKind = (data.kind as EmployeeKind | undefined) ?? current.kind;
    if (nextKind === EmployeeKind.EMPLOYEE) {
      data.voenBlindIndex = null;
      data.voenCipher = null;
      data.contractorMonthlySocialAzn = null;
    } else if (nextKind === EmployeeKind.CONTRACTOR) {
      const v =
        (typeof data.voenCipher === "string" ? (decryptText(data.voenCipher)?.trim() ?? null) : null) ??
        ((current as { voenCipher?: string | null }).voenCipher
          ? (decryptText((current as { voenCipher?: string | null }).voenCipher ?? "")?.trim() ?? null)
          : null);
      data.voenCipher = v ? encryptText(normalizeVoen(v)) : null;
      data.voenBlindIndex = v ? blindIndex("voen", normalizeVoen(v)) : null;
    }
    const positionChanged =
      dto.positionId != null && dto.positionId !== current.positionId;

    const runUpdate = async (
      client: Pick<typeof this.prisma, "employee">,
    ) =>
      client.employee.update({
        where: { id },
        data,
        include: {
          jobPosition: {
            include: { department: { select: { id: true, name: true } } },
          },
        },
      });

    try {
      if (positionChanged) {
        return await this.prisma.$transaction(
          async (tx) => {
            await this.assertPositionSlotAvailableTx(
              tx,
              organizationId,
              dto.positionId!,
              id,
            );
            return runUpdate(tx);
          },
          EmployeesService.hireGateTxOptions,
        );
      }
      return await runUpdate(this.prisma);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = `${e.meta?.target ?? ""}`;
        if (target.includes("employees_org_fin_blind_uidx")) {
          throw new ConflictException("ФИН уже занят в организации");
        }
        throw new ConflictException("ФИН уже занят в организации");
      }
      throw e;
    }
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    try {
      await this.prisma.employee.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new ConflictException("Нельзя удалить: есть расчётные листовки");
      }
      throw e;
    }
  }
}
