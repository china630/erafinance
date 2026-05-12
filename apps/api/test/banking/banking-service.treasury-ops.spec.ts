import { Decimal } from "@erafinance/database";
import { BankingService } from "../../src/banking/banking.service";

describe("BankingService treasury operations", () => {
  function makeTx(overrides?: Partial<any>) {
    return {
      organizationBankAccount: {
        findFirst: jest.fn(),
        ...overrides?.organizationBankAccount,
      },
      account: {
        findMany: jest.fn(),
        ...overrides?.account,
      },
      cbarOfficialRate: {
        findUnique: jest.fn(),
        ...overrides?.cbarOfficialRate,
      },
      bankStatement: {
        create: jest.fn().mockResolvedValue({ id: "stmt-1" }),
        ...overrides?.bankStatement,
      },
      bankStatementLine: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        create: jest.fn().mockResolvedValue({ id: "line-1" }),
        ...overrides?.bankStatementLine,
      },
    };
  }

  function makeService(tx: any, accountingOverride?: Partial<any>) {
    const prisma = {
      $transaction: jest.fn(async (cb: (t: any) => Promise<any>) => cb(tx)),
    } as any;
    const accounting = {
      postJournalInTransaction: jest.fn().mockResolvedValue({ transactionId: "tx-1" }),
      ...accountingOverride,
    } as any;
    const service = new BankingService(
      prisma,
      {} as any,
      accounting,
      {} as any,
      {} as any,
    );
    return { service, accounting, prisma };
  }

  it("createInternalTransfer rejects frozen source account", async () => {
    const tx = makeTx();
    tx.organizationBankAccount.findFirst
      .mockResolvedValueOnce({
        id: "a1",
        organizationId: "org-1",
        isArchived: false,
        isFrozen: true,
        currency: "AZN",
        ledgerAccountCode: "221.01",
        bankName: "A",
        iban: "AZ00A",
      })
      .mockResolvedValueOnce({
        id: "a2",
        organizationId: "org-1",
        isArchived: false,
        isFrozen: false,
        currency: "AZN",
        ledgerAccountCode: "221.02",
        bankName: "B",
        iban: "AZ00B",
      });
    const txFindMany = jest.fn().mockResolvedValue([
      { code: "221.01" },
      { code: "221.02" },
      { code: "231" },
      { code: "731" },
    ]);
    tx.account.findMany = txFindMany;
    const { service } = makeService(tx);

    await expect(
      service.createInternalTransfer("org-1", {
        sourceBankAccountId: "a1",
        targetBankAccountId: "a2",
        amount: 100,
        date: "2026-05-05",
        commissionAmount: 1,
      }),
    ).rejects.toThrow("frozen account cannot be used as transfer source");
  });

  it("createInternalTransfer posts balanced journal via transit account", async () => {
    const tx = makeTx();
    tx.organizationBankAccount.findFirst
      .mockResolvedValueOnce({
        id: "a1",
        organizationId: "org-1",
        isArchived: false,
        isFrozen: false,
        currency: "AZN",
        ledgerAccountCode: "221.01",
        bankName: "A",
        iban: "AZ00A",
      })
      .mockResolvedValueOnce({
        id: "a2",
        organizationId: "org-1",
        isArchived: false,
        isFrozen: false,
        currency: "AZN",
        ledgerAccountCode: "221.02",
        bankName: "B",
        iban: "AZ00B",
      });
    tx.account.findMany = jest.fn().mockResolvedValue([
      { code: "221.01" },
      { code: "221.02" },
      { code: "231" },
      { code: "731" },
    ]);

    const { service, accounting } = makeService(tx);
    await service.createInternalTransfer("org-1", {
      sourceBankAccountId: "a1",
      targetBankAccountId: "a2",
      amount: 100,
      date: "2026-05-05",
      commissionAmount: 2,
    });

    expect(accounting.postJournalInTransaction).toHaveBeenCalledTimes(1);
    const payload = accounting.postJournalInTransaction.mock.calls[0][1];
    const debit = payload.lines.reduce(
      (sum: Decimal, l: any) => sum.add(new Decimal(l.debit)),
      new Decimal(0),
    );
    const credit = payload.lines.reduce(
      (sum: Decimal, l: any) => sum.add(new Decimal(l.credit)),
      new Decimal(0),
    );
    expect(debit.equals(credit)).toBe(true);
    const lineCodes = payload.lines.map((l: any) => l.accountCode);
    expect(lineCodes).toContain("231");
  });

  it("createBankConversion posts balanced journal with FX line", async () => {
    const tx = makeTx();
    tx.organizationBankAccount.findFirst
      .mockResolvedValueOnce({
        id: "s1",
        organizationId: "org-1",
        isArchived: false,
        isFrozen: false,
        currency: "USD",
        ledgerAccountCode: "223.01",
      })
      .mockResolvedValueOnce({
        id: "t1",
        organizationId: "org-1",
        isArchived: false,
        isFrozen: false,
        currency: "EUR",
        ledgerAccountCode: "223.02",
      });
    tx.account.findMany = jest.fn().mockResolvedValue([
      { code: "223.01" },
      { code: "223.02" },
      { code: "662" },
      { code: "762" },
      { code: "731" },
    ]);
    tx.cbarOfficialRate.findUnique
      .mockResolvedValueOnce({ rate: new Decimal("1.7") }) // USD
      .mockResolvedValueOnce({ rate: new Decimal("1.8") }); // EUR

    const { service, accounting } = makeService(tx);
    await service.createBankConversion("org-1", {
      sourceBankAccountId: "s1",
      targetBankAccountId: "t1",
      sourceAmount: 1000,
      targetAmount: 900,
      date: "2026-05-05",
      commissionAmount: 10,
    });

    expect(accounting.postJournalInTransaction).toHaveBeenCalledTimes(1);
    const payload = accounting.postJournalInTransaction.mock.calls[0][1];
    const debit = payload.lines.reduce(
      (sum: Decimal, l: any) => sum.add(new Decimal(l.debit)),
      new Decimal(0),
    );
    const credit = payload.lines.reduce(
      (sum: Decimal, l: any) => sum.add(new Decimal(l.credit)),
      new Decimal(0),
    );
    expect(debit.equals(credit)).toBe(true);
    // Must include either gain(662) or loss(762) adjustment line.
    const lineCodes = payload.lines.map((l: any) => l.accountCode);
    expect(lineCodes.includes("662") || lineCodes.includes("762")).toBe(true);
  });

  it("createBankConversion rejects frozen source account", async () => {
    const tx = makeTx();
    tx.organizationBankAccount.findFirst
      .mockResolvedValueOnce({
        id: "s1",
        organizationId: "org-1",
        isArchived: false,
        isFrozen: true,
        currency: "USD",
        ledgerAccountCode: "223.01",
      })
      .mockResolvedValueOnce({
        id: "t1",
        organizationId: "org-1",
        isArchived: false,
        isFrozen: false,
        currency: "EUR",
        ledgerAccountCode: "223.02",
      });
    tx.account.findMany = jest.fn().mockResolvedValue([
      { code: "223.01" },
      { code: "223.02" },
      { code: "662" },
      { code: "762" },
      { code: "731" },
    ]);
    tx.cbarOfficialRate.findUnique
      .mockResolvedValueOnce({ rate: new Decimal("1.7") })
      .mockResolvedValueOnce({ rate: new Decimal("1.8") });

    const { service } = makeService(tx);
    await expect(
      service.createBankConversion("org-1", {
        sourceBankAccountId: "s1",
        targetBankAccountId: "t1",
        sourceAmount: 1000,
        targetAmount: 900,
        date: "2026-05-05",
        commissionAmount: 10,
      }),
    ).rejects.toThrow("frozen account cannot be used as conversion source");
  });

  it("createCashDeposit posts debit target and credit source account", async () => {
    const tx = makeTx();
    tx.organizationBankAccount.findFirst.mockResolvedValue({
      id: "b1",
      organizationId: "org-1",
      isArchived: false,
      ledgerAccountCode: "221.01",
      bankName: "Kapital",
      currency: "AZN",
    });
    tx.account.findMany = jest
      .fn()
      .mockResolvedValue([{ code: "221.01" }, { code: "251" }]);
    const { service, accounting } = makeService(tx);

    await service.createCashDeposit("org-1", {
      targetBankAccountId: "b1",
      amount: 500,
      source: "KASSA",
      date: "2026-05-05",
    });
    const payload = accounting.postJournalInTransaction.mock.calls[0][1];
    expect(payload.lines).toEqual([
      { accountCode: "221.01", debit: "500", credit: "0" },
      { accountCode: "251", debit: "0", credit: "500" },
    ]);
  });
});
