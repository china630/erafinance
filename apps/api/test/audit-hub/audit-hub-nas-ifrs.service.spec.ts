import { Test } from "@nestjs/testing";
import { AuditHubNasIfrsService } from "../../src/audit-hub/audit-hub-nas-ifrs.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("AuditHubNasIfrsService", () => {
  it("maps asymmetry rows and skips totals query when flag off", async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            transactionId: "t1",
            date: new Date("2024-06-15"),
            reference: "REF-1",
            hasNas: true,
            hasIfrs: false,
          },
        ]),
    };
    const mod = await Test.createTestingModule({
      providers: [
        AuditHubNasIfrsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const svc = mod.get(AuditHubNasIfrsService);
    const out = await svc.report("00000000-0000-0000-0000-000000000001", {
      from: "2024-06-01",
      to: "2024-06-30",
      take: 50,
      includeTotalsMismatch: false,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(out.includeTotalsMismatch).toBe(false);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({
      transactionId: "t1",
      date: "2024-06-15",
      reference: "REF-1",
      issue: "MISSING_IFRS",
    });
    expect(out.totalsMismatchItems).toEqual([]);
  });

  it("runs second query when includeTotalsMismatch is true", async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            transactionId: "t2",
            date: new Date("2024-05-01"),
            reference: null,
            nasDebitSum: "100.5",
            ifrsDebitSum: "200.1",
          },
        ]),
    };
    const mod = await Test.createTestingModule({
      providers: [
        AuditHubNasIfrsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const svc = mod.get(AuditHubNasIfrsService);
    const out = await svc.report("00000000-0000-0000-0000-000000000001", {
      from: "2024-05-01",
      to: "2024-05-31",
      take: 20,
      includeTotalsMismatch: true,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(out.totalsMismatchItems).toHaveLength(1);
    expect(out.totalsMismatchItems[0]).toMatchObject({
      transactionId: "t2",
      issue: "TOTAL_DEBIT_MISMATCH",
      nasDebitSum: "100.5",
      ifrsDebitSum: "200.1",
    });
  });
});
