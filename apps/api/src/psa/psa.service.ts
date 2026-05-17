import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Decimal,
  InvoiceStatus,
  ProjectBillingMode,
  TimeEntryStatus,
} from "@erafinance/database";
import { InvoicesService } from "../invoices/invoices.service";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import {
  dateToIsoYmdUtc,
  parseIsoDateOnly,
} from "../reporting/reporting-period.util";
import { CreatePsaProjectDto } from "./dto/create-psa-project.dto";
import { CreatePsaTaskDto } from "./dto/create-psa-task.dto";
import { CreatePsaTimeEntryDto } from "./dto/create-psa-time-entry.dto";
import { GeneratePsaInvoiceDto } from "./dto/generate-psa-invoice.dto";
import { PatchPsaTimeEntryDto } from "./dto/patch-psa-time-entry.dto";
import { UpdatePsaProjectDto } from "./dto/update-psa-project.dto";

const PSA_HOUR_SKU = "__PSA_HOUR__";

function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

@Injectable()
export class PsaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  async listProjects(
    organizationId: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where = { organizationId };
    const [items, total] = await Promise.all([
      this.prisma.psaProject.findMany({
        where,
        orderBy: [{ code: "asc" }],
        skip,
        take: pageSize,
        include: {
          counterparty: { select: { id: true, nameCipher: true } },
          _count: { select: { timeEntries: true, tasks: true } },
        },
      }),
      this.prisma.psaProject.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async createProject(organizationId: string, dto: CreatePsaProjectDto) {
    const cp = await this.prisma.counterparty.findFirst({
      where: { id: dto.counterpartyId, organizationId },
    });
    if (!cp) throw new NotFoundException("Counterparty not found");
    if (dto.departmentId) {
      const d = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId },
      });
      if (!d) throw new NotFoundException("Department not found");
    }
    return this.prisma.psaProject.create({
      data: {
        organizationId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        counterpartyId: dto.counterpartyId,
        billingMode: dto.billingMode ?? ProjectBillingMode.HOURLY,
        hourlyRate:
          dto.hourlyRate != null ? new Decimal(dto.hourlyRate) : null,
        currency: dto.currency ?? "AZN",
        departmentId: dto.departmentId ?? null,
      },
    });
  }

  async getProject(organizationId: string, id: string) {
    const p = await this.prisma.psaProject.findFirst({
      where: { id, organizationId },
      include: {
        counterparty: { select: { id: true, nameCipher: true, taxIdCipher: true } },
        tasks: true,
      },
    });
    if (!p) throw new NotFoundException("Project not found");
    return p;
  }

  async updateProject(organizationId: string, id: string, dto: UpdatePsaProjectDto) {
    await this.getProject(organizationId, id);
    if (dto.departmentId !== undefined && dto.departmentId !== null) {
      const d = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId },
      });
      if (!d) throw new NotFoundException("Department not found");
    }
    return this.prisma.psaProject.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.billingMode != null ? { billingMode: dto.billingMode } : {}),
        ...(dto.hourlyRate !== undefined
          ? {
              hourlyRate:
                dto.hourlyRate == null ? null : new Decimal(dto.hourlyRate),
            }
          : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.currency != null ? { currency: dto.currency } : {}),
      },
    });
  }

  async listTasks(organizationId: string, projectId: string) {
    await this.getProject(organizationId, projectId);
    return this.prisma.psaProjectTask.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
  }

  async createTask(organizationId: string, projectId: string, dto: CreatePsaTaskDto) {
    await this.getProject(organizationId, projectId);
    return this.prisma.psaProjectTask.create({
      data: {
        projectId,
        name: dto.name.trim(),
        estimatedHours:
          dto.estimatedHours != null ? new Decimal(dto.estimatedHours) : null,
      },
    });
  }

  async listTimeEntries(organizationId: string, projectId: string) {
    await this.getProject(organizationId, projectId);
    return this.prisma.psaTimeEntry.findMany({
      where: { projectId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { employee: { select: { id: true, finCode: true, firstName: true, lastName: true } } },
    });
  }

  async createTimeEntry(
    organizationId: string,
    projectId: string,
    dto: CreatePsaTimeEntryDto,
  ) {
    const project = await this.getProject(organizationId, projectId);
    const emp = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId },
    });
    if (!emp) throw new NotFoundException("Employee not found");
    if (dto.taskId) {
      const t = await this.prisma.psaProjectTask.findFirst({
        where: { id: dto.taskId, projectId },
      });
      if (!t) throw new NotFoundException("Task not found");
    }
    if (
      project.billingMode === ProjectBillingMode.HOURLY &&
      (project.hourlyRate == null || new Decimal(project.hourlyRate).lte(0))
    ) {
      throw new BadRequestException("Hourly project requires a positive hourlyRate");
    }
    const snap =
      project.billingMode === ProjectBillingMode.HOURLY && project.hourlyRate != null
        ? new Decimal(project.hourlyRate)
        : new Decimal(0);

    return this.prisma.psaTimeEntry.create({
      data: {
        projectId,
        taskId: dto.taskId ?? null,
        employeeId: dto.employeeId,
        date: parseIsoDateOnly(dto.date),
        hours: new Decimal(dto.hours),
        billable: dto.billable ?? true,
        hourlyRateSnapshot: snap,
        status: TimeEntryStatus.DRAFT,
      },
    });
  }

  async patchTimeEntry(
    organizationId: string,
    projectId: string,
    entryId: string,
    dto: PatchPsaTimeEntryDto,
  ) {
    await this.getProject(organizationId, projectId);
    const row = await this.prisma.psaTimeEntry.findFirst({
      where: { id: entryId, projectId },
    });
    if (!row) throw new NotFoundException("Time entry not found");
    if (dto.status == null) {
      throw new BadRequestException("status is required");
    }
    if (row.billingInvoiceId && dto.status !== TimeEntryStatus.INVOICED) {
      throw new BadRequestException("Invoiced time entry cannot change status away from INVOICED");
    }
    return this.prisma.psaTimeEntry.update({
      where: { id: entryId },
      data: { status: dto.status },
    });
  }

  async ensurePsaHourProduct(organizationId: string) {
    const existing = await this.prisma.product.findFirst({ where: { organizationId, sku: PSA_HOUR_SKU } });
    if (existing) return existing;

    const templates = await this.prisma.systemProductTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        code: true,
        nameEn: true,
        kind: true,
        defaultPrice: true,
        defaultUomCode: true,
      },
    });

    for (const t of templates) {
      await this.prisma.product.upsert({
        where: { organizationId_sku: { organizationId, sku: t.code } },
        create: {
          organizationId,
          sku: t.code,
          name: t.nameEn,
          price: t.defaultPrice,
          vatRate: new Decimal(0),
          isService: t.kind === "SERVICE",
          unitOfMeasureCode: t.defaultUomCode,
        },
        update: {
          name: t.nameEn,
          price: t.defaultPrice,
          isService: t.kind === "SERVICE",
          unitOfMeasureCode: t.defaultUomCode,
        },
      });
    }

    const seeded = await this.prisma.product.findFirst({
      where: { organizationId, sku: PSA_HOUR_SKU },
    });
    if (!seeded) {
      throw new BadRequestException("System product template __PSA_HOUR__ not found");
    }
    return seeded;
  }

  async generateInvoice(
    organizationId: string,
    projectId: string,
    dto: GeneratePsaInvoiceDto,
  ) {
    const project = await this.getProject(organizationId, projectId);
    const from = parseIsoDateOnly(dto.dateFrom);
    const to = parseIsoDateOnly(dto.dateTo);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException("dateFrom must be <= dateTo");
    }

    const entries = await this.prisma.psaTimeEntry.findMany({
      where: {
        projectId,
        status: TimeEntryStatus.APPROVED,
        billable: true,
        billingInvoiceId: null,
        date: { gte: from, lte: to },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    if (entries.length === 0) {
      throw new BadRequestException("No approved billable time entries in range");
    }

    const product = await this.ensurePsaHourProduct(organizationId);
    const items = entries.map((e) => ({
      productId: product.id,
      description: `PSA ${dateToIsoYmdUtc(e.date)}`,
      quantity: Number(e.hours.toString()),
      unitPrice: Number(e.hourlyRateSnapshot.toString()),
      vatRate: 0 as const,
    }));

    const due = addDaysUtc(to, 14);
    const created = await this.invoices.create(organizationId, {
      counterpartyId: project.counterpartyId,
      dueDate: dateToIsoYmdUtc(due),
      items,
      debitAccountCode: "101",
      projectId: project.id,
    });

    const invoiceId = (created as { id: string }).id;
    await this.prisma.$transaction(async (tx) => {
      await tx.psaTimeEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: {
          billingInvoiceId: invoiceId,
          status: TimeEntryStatus.INVOICED,
        },
      });
    });

    return { invoiceId, timeEntryIds: entries.map((e) => e.id) };
  }

  async profitability(
    organizationId: string,
    projectId: string,
    dateFrom: string,
    dateTo: string,
  ) {
    await this.getProject(organizationId, projectId);
    const from = parseIsoDateOnly(dateFrom);
    const to = parseIsoDateOnly(dateTo);

    const entries = await this.prisma.psaTimeEntry.findMany({
      where: {
        projectId,
        date: { gte: from, lte: to },
        billable: true,
      },
    });

    let approvedHours = new Decimal(0);
    let laborValueApproved = new Decimal(0);
    for (const e of entries) {
      if (
        e.status === TimeEntryStatus.APPROVED ||
        e.status === TimeEntryStatus.INVOICED
      ) {
        approvedHours = approvedHours.add(e.hours);
        laborValueApproved = laborValueApproved.add(
          new Decimal(e.hours).mul(e.hourlyRateSnapshot),
        );
      }
    }

    const invSum = await this.prisma.invoice.aggregate({
      where: {
        organizationId,
        projectId,
        status: { not: InvoiceStatus.DRAFT },
      },
      _sum: { totalAmount: true },
    });

    return {
      billableHoursApproved: approvedHours.toFixed(4),
      laborValueApprovedAzn: laborValueApproved.toFixed(4),
      invoicedNonDraftAzn: (invSum._sum.totalAmount ?? new Decimal(0)).toFixed(4),
    };
  }
}
