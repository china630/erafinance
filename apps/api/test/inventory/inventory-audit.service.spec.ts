import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  Decimal,
  InventoryAuditStatus,
  InventoryDiscrepancyKind,
  UserRole,
} from "@erafinance/database";
import { InventoryAuditService } from "../../src/inventory/inventory-audit.service";
import type { AccountingService } from "../../src/accounting/accounting.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { AccessControlService } from "../../src/access/access-control.service";
import type { StockService } from "../../src/stock/stock.service";

describe("InventoryAuditService", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const wh1 = "10000000-0000-0000-0000-000000000001";
  const p1 = "20000000-0000-0000-0000-000000000001";
  const auditId = "a0000000-0000-0000-0000-000000000001";

  const draftDto = {
    date: "2026-04-03",
    warehouseId: wh1,
    status: InventoryAuditStatus.DRAFT,
  };

  const stock = {
    getValuationMethod: jest.fn(),
    computeIssueUnitCost: jest.fn(),
  } as unknown as StockService;

  it("createReconciliationDraft: DRAFT без строк", async () => {
    const prisma = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: wh1 }),
      },
      employee: { findFirst: jest.fn() },
      inventoryAudit: {
        create: jest.fn().mockResolvedValue({
          id: auditId,
          lines: [],
          warehouse: {},
        }),
      },
    } as unknown as PrismaService;

    const accounting = {
      postJournalInTransaction: jest.fn(),
    } as unknown as AccountingService;
    const access = {
      assertMayPostAccounting: jest.fn(),
    } as unknown as AccessControlService;

    const svc = new InventoryAuditService(prisma, accounting, access, stock);

    await svc.createReconciliationDraft(orgId, {
      date: draftDto.date,
      warehouseId: wh1,
    });

    expect(prisma.inventoryAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: orgId,
          warehouseId: wh1,
          status: InventoryAuditStatus.DRAFT,
        }),
      }),
    );
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("create: не-DRAFT запрещён", async () => {
    const prisma = {
      warehouse: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const accounting = {
      postJournalInTransaction: jest.fn(),
    } as unknown as AccountingService;
    const access = {
      assertMayPostAccounting: jest.fn(),
    } as unknown as AccessControlService;

    const svc = new InventoryAuditService(prisma, accounting, access, stock);

    await expect(
      svc.create(
        orgId,
        {
          ...draftDto,
          status: InventoryAuditStatus.COMPLETED,
        },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("approveDraft: удалён — BadRequest", async () => {
    const prisma = {} as unknown as PrismaService;
    const accounting = {} as unknown as AccountingService;
    const access = {} as unknown as AccessControlService;
    const svc = new InventoryAuditService(prisma, accounting, access, stock);

    await expect(
      svc.approveDraft(orgId, auditId, "u1", UserRole.ACCOUNTANT),
    ).rejects.toThrow(BadRequestException);
  });

  it("complete: вызывает postJournalInTransaction с 201/631, 731/201 и 244/201", async () => {
    const journalCalls: unknown[] = [];

    const mockTx = {
      inventoryAudit: {
        findFirst: jest.fn().mockResolvedValue({ postedTransactionId: null }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: auditId,
          status: InventoryAuditStatus.COMPLETED,
          warehouse: { id: wh1, name: "W1", inventoryAccountCode: "201" },
          lines: [],
        }),
        update: jest.fn(),
      },
      inventoryAuditLine: {
        update: jest.fn(),
      },
      stockItem: {
        findUnique: jest.fn().mockResolvedValue({
          quantity: new Decimal(10),
          averageCost: new Decimal(2),
        }),
        upsert: jest.fn(),
      },
      stockMovement: { create: jest.fn() },
    };

    (stock.computeIssueUnitCost as jest.Mock).mockResolvedValue(new Decimal(2));

    const draftRow = {
      id: auditId,
      organizationId: orgId,
      date: new Date("2026-05-01T12:00:00.000Z"),
      status: InventoryAuditStatus.REVIEW,
      postedTransactionId: null,
      warehouseId: wh1,
      warehouse: { id: wh1, name: "W1", inventoryAccountCode: "201" },
      lines: [
        {
          id: "l1",
          productId: p1,
          systemQty: new Decimal(1),
          factQty: new Decimal(3),
          costPrice: new Decimal(5),
          discrepancyKind: InventoryDiscrepancyKind.SURPLUS,
          accountableEmployeeId: null,
          product: { isService: false },
        },
        {
          id: "l2",
          productId: "20000000-0000-0000-0000-000000000002",
          systemQty: new Decimal(5),
          factQty: new Decimal(2),
          costPrice: new Decimal(1),
          discrepancyKind: InventoryDiscrepancyKind.SHORTAGE_WRITEOFF,
          accountableEmployeeId: null,
          product: { isService: false },
        },
        {
          id: "l3",
          productId: "20000000-0000-0000-0000-000000000003",
          systemQty: new Decimal(4),
          factQty: new Decimal(1),
          costPrice: new Decimal(1),
          discrepancyKind: InventoryDiscrepancyKind.SHORTAGE_EMPLOYEE,
          accountableEmployeeId: "e0000000-0000-0000-0000-000000000001",
          product: { isService: false },
        },
      ],
    };

    const prisma = {
      inventoryAudit: {
        findFirst: jest.fn().mockResolvedValue(draftRow),
        findFirstOrThrow: jest.fn().mockResolvedValue({ ...draftRow, status: InventoryAuditStatus.COMPLETED }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings: {} }),
      },
      $transaction: jest.fn(async (fn: (t: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    } as unknown as PrismaService;

    const accounting = {
      postJournalInTransaction: jest.fn(async (_tx, params) => {
        journalCalls.push(params);
        return { transactionId: "tx-1" };
      }),
    } as unknown as AccountingService;

    const access = {
      assertMayPostAccounting: jest.fn().mockResolvedValue(undefined),
    } as unknown as AccessControlService;

    const svc = new InventoryAuditService(prisma, accounting, access, stock);

    await svc.complete(orgId, auditId, "u1", UserRole.ACCOUNTANT);

    expect(accounting.postJournalInTransaction).toHaveBeenCalledTimes(1);
    const params = journalCalls[0] as { lines: Array<{ accountCode: string; debit: unknown; credit: unknown }> };
    const codes = params.lines.map((l) => `${l.accountCode}:${l.debit}:${l.credit}`).join("|");
    expect(codes).toContain("201:");
    expect(codes).toContain("631:");
    expect(codes).toContain("731:");
    expect(codes).toContain("244:");
  });

  it("approveDraft: роль USER — Forbidden до сервиса (policy)", async () => {
    const prisma = {
      inventoryAudit: { findFirst: jest.fn() },
      organization: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const accounting = {
      postJournalInTransaction: jest.fn(),
    } as unknown as AccountingService;
    const access = {
      assertMayPostAccounting: jest.fn(),
    } as unknown as AccessControlService;

    const svc = new InventoryAuditService(prisma, accounting, access, stock);

    await expect(
      svc.approveDraft(orgId, auditId, "u1", UserRole.USER),
    ).rejects.toThrow(BadRequestException);
  });

  it("approveDraft: период закрыт — раньше проверялось; теперь approve удалён", async () => {
    const prisma = {
      inventoryAudit: { findFirst: jest.fn() },
      organization: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const accounting = { postJournalInTransaction: jest.fn() } as unknown as AccountingService;
    const access = { assertMayPostAccounting: jest.fn() } as unknown as AccessControlService;
    const svc = new InventoryAuditService(prisma, accounting, access, stock);
    await expect(
      svc.approveDraft(orgId, auditId, "u1", UserRole.ACCOUNTANT),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("approveDraft: PROCUREMENT — approve удалён (BadRequest)", async () => {
    const prisma = {
      inventoryAudit: { findFirst: jest.fn() },
      organization: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const accounting = { postJournalInTransaction: jest.fn() } as unknown as AccountingService;
    const access = {
      assertMayPostAccounting: jest
        .fn()
        .mockRejectedValue(new ForbiddenException("ACCOUNTING_ROLE_REQUIRED")),
    } as unknown as AccessControlService;
    const svc = new InventoryAuditService(prisma, accounting, access, stock);
    await expect(
      svc.approveDraft(orgId, auditId, "u1", UserRole.PROCUREMENT),
    ).rejects.toThrow(BadRequestException);
  });
});
