import { Test } from "@nestjs/testing";
import { AuditHubRiskService } from "../../src/audit-hub/audit-hub-risk.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("AuditHubRiskService", () => {
  it("merges five detector queries into one payload", async () => {
    const cashPair = {
      idA: "a1",
      idB: "b1",
      dateA: new Date("2024-01-02"),
      dateB: new Date("2024-01-03"),
      orderNumberA: "KO1",
      orderNumberB: "KO2",
      amount: "10",
      cashAccountCode: "101.01",
      counterpartyId: "cp1",
      dateGapDays: 1,
    };
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([cashPair])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const mod = await Test.createTestingModule({
      providers: [
        AuditHubRiskService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const svc = mod.get(AuditHubRiskService);
    const out = await svc.report("00000000-0000-0000-0000-000000000001", {
      from: "2024-01-01",
      to: "2024-01-31",
      windowDays: 7,
      take: 10,
      expenseMinDebit: 1,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(5);
    expect(out.detectors.duplicateCashOrders.pairs).toHaveLength(1);
    expect(out.detectors.duplicateCashOrders.pairs[0]).toMatchObject({
      cashOrderIdA: "a1",
      cashOrderIdB: "b1",
      amount: "10",
      cashAccountCode: "101.01",
      counterpartyId: "cp1",
      dateGapDays: 1,
    });
    expect(out.detectors.duplicateInvoicePayments.pairs).toEqual([]);
  });
});
