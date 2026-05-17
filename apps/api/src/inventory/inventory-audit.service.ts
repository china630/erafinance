import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryAuditStatus,
  InventoryDiscrepancyKind,
  Prisma,
  StockMovementReason,
  StockMovementType,
  UserRole,
} from "@erafinance/database";
import { assertMayPostManualJournal } from "../auth/policies/invoice-finance.policy";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import type { CreateInventoryAuditDto } from "./dto/create-inventory-audit.dto";
import { AccountingService } from "../accounting/accounting.service";
import { getClosedPeriodKeys, monthKeyUtc } from "../reporting/reporting-period.util";
import { AccessControlService } from "../access/access-control.service";
import {
  ACCOUNTABLE_PERSONS_ACCOUNT_CODE,
  FINISHED_GOODS_ACCOUNT_CODE,
  INVENTORY_GOODS_ACCOUNT_CODE,
  INVENTORY_SURPLUS_INCOME_ACCOUNT_CODE,
  MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
} from "../ledger.constants";
import { StockService } from "../stock/stock.service";
import { parseInventorySettings } from "./inventory-settings";
import { assertWarehouseNotUnderReconciliation } from "./inventory-reconciliation-lock";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

const EPS = new Decimal("0.0001");

export type CreateReconciliationDraftInput = {
  date: string;
  warehouseId: string;
  number?: string | null;
  responsibleEmployeeId?: string | null;
  notes?: string | null;
};

@Injectable()
export class InventoryAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly access: AccessControlService,
    private readonly stock: StockService,
  ) {}

  async findAll(
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
      this.prisma.inventoryAudit.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: { warehouse: { select: { id: true, name: true } } },
      }),
      this.prisma.inventoryAudit.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(organizationId: string, id: string) {
    const row = await this.prisma.inventoryAudit.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, name: true, inventoryAccountCode: true } },
        responsibleEmployee: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { id: true, name: true, sku: true, isService: true } },
            accountableEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException("Инвентаризационная опись не найдена");
    }
    return row;
  }

  /**
   * @deprecated Use reconciliation flow (`createReconciliationDraft` + `startCounting` + `complete`).
   */
  async create(
    organizationId: string,
    dto: CreateInventoryAuditDto,
    actingUserRole: UserRole,
  ) {
    const status = dto.status ?? InventoryAuditStatus.DRAFT;
    if (status !== InventoryAuditStatus.DRAFT) {
      throw new BadRequestException(
        "Only DRAFT is supported for create; use reconciliation endpoints for COUNTING/REVIEW/COMPLETED",
      );
    }
    assertMayPostManualJournal(actingUserRole);
    return this.createReconciliationDraft(organizationId, {
      date: dto.date,
      warehouseId: dto.warehouseId,
    });
  }

  async createReconciliationDraft(
    organizationId: string,
    input: CreateReconciliationDraftInput,
  ) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: input.warehouseId, organizationId },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException("Warehouse not found");

    if (input.responsibleEmployeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: input.responsibleEmployeeId, organizationId },
        select: { id: true },
      });
      if (!emp) throw new BadRequestException("Responsible employee not found");
    }

    const date = new Date(input.date);

    return this.prisma.inventoryAudit.create({
      data: {
        organizationId,
        warehouseId: input.warehouseId,
        date,
        status: InventoryAuditStatus.DRAFT,
        number: input.number?.trim() || null,
        responsibleEmployeeId: input.responsibleEmployeeId ?? null,
        notes: input.notes?.trim() || null,
      },
      include: {
        warehouse: { select: { id: true, name: true, inventoryAccountCode: true } },
        lines: true,
      },
    });
  }

  async startCounting(organizationId: string, auditId: string, actingUserRole: UserRole) {
    assertMayPostManualJournal(actingUserRole);

    const audit = await this.prisma.inventoryAudit.findFirst({
      where: { id: auditId, organizationId, status: InventoryAuditStatus.DRAFT },
      select: { id: true, date: true, warehouseId: true },
    });
    if (!audit) {
      throw new NotFoundException("Inventory reconciliation draft not found");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closed = getClosedPeriodKeys(org?.settings);
    const periodKey = monthKeyUtc(audit.date);
    if (closed.includes(periodKey)) {
      throw new BadRequestException(`Период ${periodKey} закрыт: начать пересчёт нельзя`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertWarehouseNotUnderReconciliation(tx, organizationId, audit.warehouseId);

        await tx.inventoryAuditLine.deleteMany({
          where: { inventoryAuditId: audit.id },
        });

        const stock = await tx.stockItem.findMany({
          where: { organizationId, warehouseId: audit.warehouseId },
          include: {
            product: { select: { id: true, isService: true, unitOfMeasureCode: true } },
          },
          orderBy: { createdAt: "asc" },
        });

        const lineRows = stock
          .filter((s) => !s.product?.isService)
          .map((s) => ({
            organizationId,
            inventoryAuditId: audit.id,
            productId: s.productId,
            systemQty: s.quantity,
            factQty: s.quantity,
            costPrice: s.averageCost,
            unitOfMeasureCode: s.product?.unitOfMeasureCode ?? null,
            discrepancyKind: InventoryDiscrepancyKind.NONE,
            postedAmountAzn: new Decimal(0),
          }));

        if (lineRows.length) {
          await tx.inventoryAuditLine.createMany({ data: lineRows });
        }

        await tx.inventoryAudit.update({
          where: { id: audit.id },
          data: {
            status: InventoryAuditStatus.COUNTING,
            startedAt: new Date(),
          },
        });

        return this.findOneInTx(tx, organizationId, audit.id);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException({
          code: "WAREHOUSE_LOCKED_FOR_RECONCILIATION",
          warehouseId: audit.warehouseId,
          message: "Another active reconciliation exists for this warehouse",
        });
      }
      throw e;
    }
  }

  async setLineFact(
    organizationId: string,
    lineId: string,
    dto: { factQty?: number; costPrice?: number; unitCost?: number },
    actingUserRole: UserRole,
  ) {
    assertMayPostManualJournal(actingUserRole);
    const row = await this.prisma.inventoryAuditLine.findFirst({
      where: { id: lineId, organizationId },
      include: {
        inventoryAudit: { select: { id: true, status: true, date: true } },
      },
    });
    if (!row) throw new NotFoundException("Inventory audit line not found");
    if (row.inventoryAudit.status !== InventoryAuditStatus.COUNTING) {
      throw new BadRequestException("Facts can only be edited in COUNTING status");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closed = getClosedPeriodKeys(org?.settings);
    const key = monthKeyUtc(row.inventoryAudit.date);
    if (closed.includes(key)) {
      throw new BadRequestException(`Период ${key} закрыт: редактирование недоступно`);
    }

    const data: Prisma.InventoryAuditLineUpdateInput = {};
    if (dto.factQty != null) {
      const f = new Decimal(dto.factQty);
      if (f.lt(0)) throw new BadRequestException("factQty must be >= 0");
      data.factQty = f;
    }
    const costFromDto =
      dto.unitCost != null ? new Decimal(dto.unitCost) : dto.costPrice != null ? new Decimal(dto.costPrice) : null;
    if (costFromDto != null) {
      if (costFromDto.lt(0)) throw new BadRequestException("cost / unit cost must be >= 0");
      data.costPrice = costFromDto;
    }

    const nextFact =
      dto.factQty != null ? new Decimal(dto.factQty) : new Decimal(row.factQty);
    const delta = nextFact.sub(new Decimal(row.systemQty));
    if (delta.abs().lt(EPS)) {
      data.discrepancyKind = InventoryDiscrepancyKind.NONE;
      data.accountableEmployee = { disconnect: true };
      data.reasonNote = null;
    } else {
      data.discrepancyKind = InventoryDiscrepancyKind.NONE;
      data.accountableEmployee = { disconnect: true };
    }

    if (Object.keys(data).length === 0) return row;

    return this.prisma.inventoryAuditLine.update({
      where: { id: row.id },
      data,
    });
  }

  async submitForReview(organizationId: string, auditId: string, actingUserRole: UserRole) {
    assertMayPostManualJournal(actingUserRole);
    const audit = await this.prisma.inventoryAudit.findFirst({
      where: { id: auditId, organizationId, status: InventoryAuditStatus.COUNTING },
      include: { lines: { select: { id: true, factQty: true } } },
    });
    if (!audit) {
      throw new NotFoundException("Inventory reconciliation not in COUNTING");
    }
    if (!audit.lines.length) {
      throw new BadRequestException("No lines to submit; stock snapshot is empty");
    }

    return this.prisma.inventoryAudit.update({
      where: { id: audit.id },
      data: { status: InventoryAuditStatus.REVIEW },
      include: {
        warehouse: { select: { id: true, name: true, inventoryAccountCode: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { id: true, name: true, sku: true, isService: true } },
          },
        },
      },
    });
  }

  async classifyLine(
    organizationId: string,
    lineId: string,
    dto: {
      discrepancyKind: InventoryDiscrepancyKind;
      accountableEmployeeId?: string | null;
      reasonNote?: string | null;
    },
    actingUserRole: UserRole,
  ) {
    assertMayPostManualJournal(actingUserRole);
    const row = await this.prisma.inventoryAuditLine.findFirst({
      where: { id: lineId, organizationId },
      include: {
        inventoryAudit: { select: { id: true, status: true, date: true } },
      },
    });
    if (!row) throw new NotFoundException("Inventory audit line not found");
    if (row.inventoryAudit.status !== InventoryAuditStatus.REVIEW) {
      throw new BadRequestException("Classification is only allowed in REVIEW");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closed = getClosedPeriodKeys(org?.settings);
    const key = monthKeyUtc(row.inventoryAudit.date);
    if (closed.includes(key)) {
      throw new BadRequestException(`Период ${key} закрыт`);
    }

    const system = new Decimal(row.systemQty);
    const fact = new Decimal(row.factQty);
    const delta = fact.sub(system);

    if (dto.discrepancyKind === InventoryDiscrepancyKind.NONE) {
      if (delta.abs().gte(EPS)) {
        throw new BadRequestException("NONE is only valid when delta is zero");
      }
    } else if (dto.discrepancyKind === InventoryDiscrepancyKind.SURPLUS) {
      if (!delta.gt(EPS)) {
        throw new BadRequestException("SURPLUS requires delta > 0");
      }
    } else if (
      dto.discrepancyKind === InventoryDiscrepancyKind.SHORTAGE_WRITEOFF ||
      dto.discrepancyKind === InventoryDiscrepancyKind.SHORTAGE_EMPLOYEE
    ) {
      if (!delta.lt(EPS.neg())) {
        throw new BadRequestException("SHORTAGE_* requires delta < 0");
      }
    }

    if (dto.discrepancyKind === InventoryDiscrepancyKind.SHORTAGE_EMPLOYEE) {
      if (!dto.accountableEmployeeId) {
        throw new BadRequestException("accountableEmployeeId is required for SHORTAGE_EMPLOYEE");
      }
      const emp = await this.prisma.employee.findFirst({
        where: { id: dto.accountableEmployeeId, organizationId },
        select: { id: true },
      });
      if (!emp) throw new BadRequestException("Accountable employee not found");
    }

    return this.prisma.inventoryAuditLine.update({
      where: { id: row.id },
      data: {
        discrepancyKind: dto.discrepancyKind,
        accountableEmployee:
          dto.discrepancyKind === InventoryDiscrepancyKind.SHORTAGE_EMPLOYEE &&
          dto.accountableEmployeeId
            ? { connect: { id: dto.accountableEmployeeId } }
            : { disconnect: true },
        reasonNote: dto.reasonNote?.trim() || null,
      },
    });
  }

  async complete(
    organizationId: string,
    auditId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ) {
    await this.access.assertMayPostAccounting(actingUserId, organizationId);
    assertMayPostManualJournal(actingUserRole);

    const draft = await this.prisma.inventoryAudit.findFirst({
      where: { id: auditId, organizationId, status: InventoryAuditStatus.REVIEW },
      include: {
        warehouse: { select: { id: true, name: true, inventoryAccountCode: true } },
        lines: {
          include: {
            product: { select: { id: true, isService: true } },
          },
        },
      },
    });
    if (!draft) {
      throw new NotFoundException("Inventory reconciliation not in REVIEW");
    }
    if (draft.postedTransactionId) {
      throw new ConflictException("Reconciliation already completed");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closed = getClosedPeriodKeys(org?.settings);
    const periodKey = monthKeyUtc(draft.date);
    if (closed.includes(periodKey)) {
      throw new BadRequestException(`Период ${periodKey} закрыт: проведение недоступно`);
    }

    const allowNeg = !!parseInventorySettings(org?.settings).allowNegativeStock;

    for (const line of draft.lines) {
      const delta = new Decimal(line.factQty).sub(new Decimal(line.systemQty));
      if (delta.abs().lt(EPS)) continue;
      if (line.discrepancyKind === InventoryDiscrepancyKind.NONE) {
        throw new BadRequestException(
          `Line ${line.productId}: non-zero delta requires classification`,
        );
      }
    }

    const documentDate = new Date(
      Date.UTC(
        draft.date.getUTCFullYear(),
        draft.date.getUTCMonth(),
        draft.date.getUTCDate(),
        12,
        0,
        0,
        0,
      ),
    );
    const invAcc =
      draft.warehouse.inventoryAccountCode === "204"
        ? FINISHED_GOODS_ACCOUNT_CODE
        : INVENTORY_GOODS_ACCOUNT_CODE;

    return this.prisma.$transaction(async (tx) => {
      const fresh = await tx.inventoryAudit.findFirst({
        where: { id: auditId, organizationId, status: InventoryAuditStatus.REVIEW },
        select: { postedTransactionId: true },
      });
      if (!fresh) throw new NotFoundException("Inventory reconciliation not in REVIEW");
      if (fresh.postedTransactionId) {
        throw new ConflictException("Reconciliation already completed");
      }

      let surplusTotal = new Decimal(0);
      let shortageWriteoffTotal = new Decimal(0);
      let shortageEmployeeTotal = new Decimal(0);
      const accountableIds = new Set<string>();

      for (const line of draft.lines) {
        if (line.product.isService) {
          throw new BadRequestException(`Product ${line.productId} is a service`);
        }
        const system = new Decimal(line.systemQty);
        const fact = new Decimal(line.factQty);
        const delta = fact.sub(system);
        if (delta.abs().lt(EPS)) {
          await tx.inventoryAuditLine.update({
            where: { id: line.id },
            data: { postedAmountAzn: new Decimal(0) },
          });
          continue;
        }

        const kind = line.discrepancyKind;
        if (kind === InventoryDiscrepancyKind.SURPLUS) {
          const qtyAbs = delta;
          const unit = new Decimal(line.costPrice ?? 0);
          if (unit.lt(0)) {
            throw new BadRequestException(`Invalid cost for product ${line.productId}`);
          }
          const amount = qtyAbs.mul(unit);
          surplusTotal = surplusTotal.add(amount);

          const existing = await tx.stockItem.findUnique({
            where: {
              organizationId_warehouseId_productId: {
                organizationId,
                warehouseId: draft.warehouseId,
                productId: line.productId,
              },
            },
          });
          const q0 = existing?.quantity ?? new Decimal(0);
          const c0 = existing?.averageCost ?? new Decimal(0);
          const q1 = q0.add(qtyAbs);
          const c1 =
            q1.lte(0) ? new Decimal(0) : q0.lte(0) ? unit : q0.mul(c0).add(qtyAbs.mul(unit)).div(q1);

          await tx.stockItem.upsert({
            where: {
              organizationId_warehouseId_productId: {
                organizationId,
                warehouseId: draft.warehouseId,
                productId: line.productId,
              },
            },
            create: {
              organizationId,
              warehouseId: draft.warehouseId,
              productId: line.productId,
              quantity: q1,
              averageCost: c1,
            },
            update: { quantity: q1, averageCost: c1 },
          });

          await tx.stockMovement.create({
            data: {
              organizationId,
              warehouseId: draft.warehouseId,
              productId: line.productId,
              type: StockMovementType.IN,
              reason: StockMovementReason.ADJUSTMENT,
              quantity: qtyAbs,
              price: unit,
              note: `INV_RECON:${draft.id}`,
              documentDate,
            },
          });

          await tx.inventoryAuditLine.update({
            where: { id: line.id },
            data: { postedAmountAzn: amount },
          });
        } else if (
          kind === InventoryDiscrepancyKind.SHORTAGE_WRITEOFF ||
          kind === InventoryDiscrepancyKind.SHORTAGE_EMPLOYEE
        ) {
          const qtyAbs = delta.abs();
          const existing = await tx.stockItem.findUnique({
            where: {
              organizationId_warehouseId_productId: {
                organizationId,
                warehouseId: draft.warehouseId,
                productId: line.productId,
              },
            },
          });
          const avail = existing?.quantity ?? new Decimal(0);
          const avg = existing?.averageCost ?? new Decimal(0);
          if (avail.lt(qtyAbs) && !allowNeg) {
            throw new BadRequestException(
              `Недостаточно товара для списания (product ${line.productId})`,
            );
          }
          const unit = await this.stock.computeIssueUnitCost(
            tx,
            organizationId,
            draft.warehouseId,
            line.productId,
            qtyAbs,
            avg,
            avg,
          );
          const amount = qtyAbs.mul(unit);

          if (kind === InventoryDiscrepancyKind.SHORTAGE_WRITEOFF) {
            shortageWriteoffTotal = shortageWriteoffTotal.add(amount);
          } else {
            shortageEmployeeTotal = shortageEmployeeTotal.add(amount);
            if (line.accountableEmployeeId) {
              accountableIds.add(line.accountableEmployeeId);
            }
          }

          const qNew = avail.sub(qtyAbs);
          await tx.stockItem.upsert({
            where: {
              organizationId_warehouseId_productId: {
                organizationId,
                warehouseId: draft.warehouseId,
                productId: line.productId,
              },
            },
            create: {
              organizationId,
              warehouseId: draft.warehouseId,
              productId: line.productId,
              quantity: qNew,
              averageCost: unit,
            },
            update: { quantity: qNew },
          });

          await tx.stockMovement.create({
            data: {
              organizationId,
              warehouseId: draft.warehouseId,
              productId: line.productId,
              type: StockMovementType.OUT,
              reason: StockMovementReason.ADJUSTMENT,
              quantity: qtyAbs,
              price: unit,
              note: `INV_RECON:${draft.id}`,
              documentDate,
            },
          });

          await tx.inventoryAuditLine.update({
            where: { id: line.id },
            data: { postedAmountAzn: amount },
          });
        } else {
          throw new BadRequestException(`Line ${line.productId}: invalid discrepancy state`);
        }
      }

      const glLines: Array<{ accountCode: string; debit: string | number; credit: string | number }> =
        [];
      if (surplusTotal.gt(0)) {
        glLines.push(
          { accountCode: invAcc, debit: surplusTotal.toString(), credit: 0 },
          {
            accountCode: INVENTORY_SURPLUS_INCOME_ACCOUNT_CODE,
            debit: 0,
            credit: surplusTotal.toString(),
          },
        );
      }
      if (shortageWriteoffTotal.gt(0)) {
        glLines.push(
          {
            accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
            debit: shortageWriteoffTotal.toString(),
            credit: 0,
          },
          { accountCode: invAcc, debit: 0, credit: shortageWriteoffTotal.toString() },
        );
      }
      if (shortageEmployeeTotal.gt(0)) {
        glLines.push(
          {
            accountCode: ACCOUNTABLE_PERSONS_ACCOUNT_CODE,
            debit: shortageEmployeeTotal.toString(),
            credit: 0,
          },
          { accountCode: invAcc, debit: 0, credit: shortageEmployeeTotal.toString() },
        );
      }

      let transactionId: string | null = null;
      if (glLines.length) {
        const empNote =
          accountableIds.size > 0
            ? ` AccountableEmployeeIds: ${[...accountableIds].join(",")}.`
            : "";
        const { transactionId: tid } = await this.accounting.postJournalInTransaction(tx, {
          organizationId,
          date: draft.date,
          reference: `INV-RECON-${draft.id}`,
          description: `Сличительная ведомость (${draft.warehouse.name}).${empNote}`,
          isFinal: true,
          lines: glLines,
        });
        transactionId = tid;
      }

      await tx.inventoryAudit.update({
        where: { id: draft.id },
        data: {
          status: InventoryAuditStatus.COMPLETED,
          completedAt: new Date(),
          postedTransactionId: transactionId,
        },
      });

      return this.findOneInTx(tx, organizationId, draft.id);
    });
  }

  async cancel(
    organizationId: string,
    auditId: string,
    actingUserRole: UserRole,
    dto?: { reason?: string },
  ) {
    assertMayPostManualJournal(actingUserRole);
    const audit = await this.prisma.inventoryAudit.findFirst({
      where: {
        id: auditId,
        organizationId,
        status: {
          in: [
            InventoryAuditStatus.DRAFT,
            InventoryAuditStatus.COUNTING,
            InventoryAuditStatus.REVIEW,
          ],
        },
      },
      select: { id: true, notes: true },
    });
    if (!audit) {
      throw new NotFoundException("Inventory reconciliation cannot be cancelled in this state");
    }

    const reason = dto?.reason?.trim();
    const notesPatch =
      reason && reason.length > 0
        ? [audit.notes?.trim() || "", `Cancelled: ${reason}`].filter(Boolean).join("\n")
        : undefined;

    await this.prisma.inventoryAudit.update({
      where: { id: audit.id },
      data: {
        status: InventoryAuditStatus.CANCELLED,
        cancelledAt: new Date(),
        ...(notesPatch !== undefined ? { notes: notesPatch } : {}),
      },
    });

    return this.findOne(organizationId, audit.id);
  }

  /**
   * @deprecated Replaced by `complete` on reconciliation workflow.
   */
  async approveDraft(
    organizationId: string,
    id: string,
    _actingUserId: string,
    _actingUserRole: UserRole,
  ) {
    void organizationId;
    void id;
    throw new BadRequestException(
      "approveDraft is removed: use POST /api/inventory/reconciliations/:id/complete after REVIEW",
    );
  }

  /**
   * @deprecated Snapshot is taken on `startCounting`.
   */
  async syncSystemFromStock(
    organizationId: string,
    auditId: string,
    actingUserRole: UserRole,
  ) {
    void organizationId;
    void auditId;
    void actingUserRole;
    throw new BadRequestException(
      "syncSystemFromStock is deprecated: start counting refreshes the snapshot",
    );
  }

  private findOneInTx(tx: Prisma.TransactionClient, organizationId: string, id: string) {
    return tx.inventoryAudit.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, name: true, inventoryAccountCode: true } },
        responsibleEmployee: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { id: true, name: true, sku: true, isService: true } },
            accountableEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async patchLine(
    organizationId: string,
    lineId: string,
    dto: { factQty?: number; costPrice?: number; unitCost?: number },
    actingUserRole: UserRole,
  ) {
    return this.setLineFact(organizationId, lineId, dto, actingUserRole);
  }
}
