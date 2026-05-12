import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AccountType, LedgerType } from "@erafinance/database";
import { BankSubaccountService } from "../../src/accounting/bank-subaccount.service";
import type { PrismaService } from "../../src/prisma/prisma.service";

describe("BankSubaccountService", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const branchId = "00000000-0000-0000-0000-00000000000b";

  function makePrisma(rows: ReadonlyArray<{ code: string }>) {
    const prisma = {
      account: {
        findMany: jest.fn().mockResolvedValue(rows),
        findFirst: jest.fn().mockResolvedValue({ id: "a221" }),
        create: jest.fn(async ({ data }: { data: { code: string } }) => ({
          id: "new-acc",
          code: data.code,
          nameAz: "x",
          currency: "AZN",
        })),
      },
      organizationBankAccount: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      bankBranch: {
        findUnique: jest.fn().mockResolvedValue({
          id: branchId,
          name: "Baş ofis",
          isActive: true,
          bank: {
            id: "bank-1",
            code: "14",
            nameAz: "\"Kapital Bank\" ASC",
            isActive: true,
          },
        }),
      },
    } as unknown as PrismaService;
    return prisma;
  }

  it("nextSubaccountCode returns 01 when there are no existing subaccounts", async () => {
    const prisma = makePrisma([]);
    const svc = new BankSubaccountService(prisma);
    const code = await svc.nextSubaccountCode(orgId, "14");
    expect(code).toBe("221.14.01");
  });

  it("nextSubaccountCode picks max+1 across nested codes", async () => {
    const prisma = makePrisma([
      { code: "221.14.01" },
      { code: "221.14.02" },
      { code: "221.14.05.01" },
      { code: "221.14.03" },
    ]);
    const svc = new BankSubaccountService(prisma);
    const code = await svc.nextSubaccountCode(orgId, "14");
    expect(code).toBe("221.14.06");
  });

  it("nextSubaccountCode rejects invalid bank code", async () => {
    const prisma = makePrisma([]);
    const svc = new BankSubaccountService(prisma);
    await expect(svc.nextSubaccountCode(orgId, "1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("nextSubaccountCode overflows past 99", async () => {
    const prisma = makePrisma([{ code: "221.14.99" }]);
    const svc = new BankSubaccountService(prisma);
    await expect(svc.nextSubaccountCode(orgId, "14")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("ensureSubaccountForBranch creates a 221.<bankCode>.<seq> ASSET account", async () => {
    const prisma = makePrisma([{ code: "221.14.01" }]);
    const svc = new BankSubaccountService(prisma);
    const result = await svc.ensureSubaccountForBranch(orgId, branchId, {
      currency: "AZN",
    });
    expect(result.created).toBe(true);
    expect(result.code).toBe("221.14.02");
    const create = (prisma.account.create as jest.Mock).mock.calls[0][0];
    expect(create.data).toMatchObject({
      organizationId: orgId,
      code: "221.14.02",
      type: AccountType.ASSET,
      ledgerType: LedgerType.NAS,
      currency: "AZN",
      parentId: "a221",
    });
  });

  it("ensureSubaccountForBranch is idempotent when org bank account already exists", async () => {
    const prisma = makePrisma([{ code: "221.14.01" }]);
    (prisma.organizationBankAccount.findFirst as jest.Mock).mockResolvedValueOnce({
      ledgerAccountCode: "221.14.01",
    });
    (prisma.account.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "old-acc",
      code: "221.14.01",
      nameAz: "Kapital — Baş ofis",
      currency: "AZN",
    });
    const svc = new BankSubaccountService(prisma);
    const result = await svc.ensureSubaccountForBranch(orgId, branchId, {
      currency: "AZN",
    });
    expect(result.created).toBe(false);
    expect(result.code).toBe("221.14.01");
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("ensureSubaccountForBranch rejects unknown branch", async () => {
    const prisma = makePrisma([]);
    (prisma.bankBranch.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const svc = new BankSubaccountService(prisma);
    await expect(
      svc.ensureSubaccountForBranch(orgId, branchId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("ensureSubaccountForBranch rejects inactive bank branch", async () => {
    const prisma = makePrisma([]);
    (prisma.bankBranch.findUnique as jest.Mock).mockResolvedValueOnce({
      id: branchId,
      name: "Closed branch",
      isActive: false,
      bank: { id: "b", code: "14", nameAz: "X", isActive: true },
    });
    const svc = new BankSubaccountService(prisma);
    await expect(
      svc.ensureSubaccountForBranch(orgId, branchId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
