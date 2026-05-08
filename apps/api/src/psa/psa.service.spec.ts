import { BadRequestException } from "@nestjs/common";
import { PsaService } from "./psa.service";

describe("PsaService.generateInvoice", () => {
  it("rejects inverted date range", async () => {
    const prisma = {
      psaProject: {
        findFirst: jest.fn().mockResolvedValue({
          id: "proj",
          organizationId: "org",
          counterpartyId: "cp",
          billingMode: "HOURLY",
          hourlyRate: { toString: () => "10" },
          tasks: [],
          counterparty: { id: "cp" },
        }),
      },
    };
    const invoices = {};
    const svc = new PsaService(prisma as any, invoices as any);
    await expect(
      svc.generateInvoice("org", "proj", {
        dateFrom: "2026-05-10",
        dateTo: "2026-05-01",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
