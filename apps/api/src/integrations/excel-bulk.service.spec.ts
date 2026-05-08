import { ExcelBulkService } from "./excel-bulk.service";
import ExcelJS from "exceljs";

describe("ExcelBulkService", () => {
  it("exports invoice workbook buffer", async () => {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "inv-1",
            number: "INV-1",
            currency: "AZN",
            totalAmount: { toString: () => "10.00" },
            counterparty: { name: "CP", taxId: "1234567890" },
          },
        ]),
      },
    };
    const syncRuns = { start: jest.fn().mockResolvedValue("run-1") };
    const service = new ExcelBulkService(prisma as never, syncRuns as never);
    const out = await service.exportInvoices("org-1", ["inv-1"]);
    expect(out.byteLength).toBeGreaterThan(100);
    expect(syncRuns.start).toHaveBeenCalled();
  });

  it("exportCustoms builds xlsx buffer", async () => {
    const prisma = {
      customsDeclaration: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "c1",
            bgdNumber: "BGD-1",
            bgdDate: new Date("2025-01-05T00:00:00.000Z"),
            currency: "AZN",
            customsValueAzn: { toString: () => "100" },
            customsDutyAzn: { toString: () => "10" },
            customsVatAzn: { toString: () => "18" },
            feesAzn: { toString: () => "0" },
            notes: null,
          },
        ]),
      },
    };
    const syncRuns = {
      start: jest.fn().mockResolvedValue("run-c"),
      complete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ExcelBulkService(prisma as never, syncRuns as never);
    const buf = await service.exportCustoms("org-1", []);
    expect(buf.byteLength).toBeGreaterThan(80);
    expect(syncRuns.start).toHaveBeenCalledWith(
      expect.objectContaining({ portal: "CUSTOMS", flow: "bgd-export" }),
    );
    expect(syncRuns.complete).toHaveBeenCalled();
  });

  it("importCustoms accepts valid sheet", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("BGD");
    ws.addRow([
      "bgdNumber",
      "bgdDate",
      "currency",
      "customsValueAzn",
      "customsDutyAzn",
      "customsVatAzn",
      "feesAzn",
      "notes",
    ]);
    ws.addRow(["BGD-X-1", "2025-03-01", "AZN", 50, 5, 9, 0, ""]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const created: unknown[] = [];
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          customsDeclaration: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(async ({ data }: { data: { bgdNumber: string } }) => {
              created.push(data);
            }),
          },
        };
        await fn(tx);
      }),
    };
    const syncRuns = {
      start: jest.fn().mockResolvedValue("run-i"),
      complete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ExcelBulkService(prisma as never, syncRuns as never);
    const out = await service.importCustoms("org-1", buffer, "user-1");
    expect(out.inserted).toBe(1);
    expect(out.skipped).toBe(0);
    expect(syncRuns.complete).toHaveBeenCalled();
  });
});
