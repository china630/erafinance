import { BadRequestException } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";

function makeServiceWithInvoice(invoice: unknown) {
  const prisma = {
    invoice: {
      findFirst: jest.fn().mockResolvedValue(invoice),
    },
  };
  const service = new InvoicesService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, prisma };
}

describe("InvoicesService.getExtensionPrefill", () => {
  it("maps VAT and exempt lines correctly", async () => {
    const { service } = makeServiceWithInvoice({
      id: "inv-1",
      number: "INV-001",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      currency: "AZN",
      totalAmount: { toString: () => "218" },
      counterparty: {
        id: "cp-1",
        name: "Counterparty LLC",
        taxId: "1234567890",
        legalForm: "LLC",
        address: "Baku",
        isVatPayer: true,
      },
      items: [
        {
          description: "Goods",
          quantity: { toString: () => "1" },
          unitPrice: { toString: () => "100" },
          vatRate: { toString: () => "18" },
          lineTotal: { toString: () => "118" },
          product: { sku: "SKU-1", name: "Goods" },
        },
        {
          description: "Exempt",
          quantity: { toString: () => "1" },
          unitPrice: { toString: () => "100" },
          vatRate: { toString: () => "-1" },
          lineTotal: { toString: () => "100" },
          product: { sku: "SKU-2", name: "Exempt" },
        },
      ],
    });

    const prefill = await service.getExtensionPrefill("org-1", "inv-1");
    expect(prefill.currency).toBe("AZN");
    expect(prefill.items).toHaveLength(2);
    expect(prefill.items[0].vatRatePct).toBe(18);
    expect(prefill.items[0].vatExempt).toBe(false);
    expect(prefill.items[1].vatRatePct).toBe(0);
    expect(prefill.items[1].vatExempt).toBe(true);
  });

  it("throws when invoice currency is not AZN", async () => {
    const { service } = makeServiceWithInvoice({
      id: "inv-2",
      number: "INV-002",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      currency: "USD",
      totalAmount: { toString: () => "10" },
      counterparty: {
        id: "cp-1",
        name: "Counterparty LLC",
        taxId: "1234567890",
        legalForm: "LLC",
        address: "Baku",
        isVatPayer: true,
      },
      items: [],
    });

    await expect(service.getExtensionPrefill("org-1", "inv-2")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("normalizes invalid taxId to null", async () => {
    const { service } = makeServiceWithInvoice({
      id: "inv-3",
      number: "INV-003",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      currency: "AZN",
      totalAmount: { toString: () => "0" },
      counterparty: {
        id: "cp-1",
        name: "Counterparty LLC",
        taxId: "",
        legalForm: "LLC",
        address: "Baku",
        isVatPayer: true,
      },
      items: [],
    });

    const prefill = await service.getExtensionPrefill("org-1", "inv-3");
    expect(prefill.counterparty.taxId).toBeNull();
  });

  it("rejects international invoice for DVX prefill", async () => {
    const { service } = makeServiceWithInvoice({
      id: "inv-4",
      number: "INV-004",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      currency: "AZN",
      isInternational: true,
      totalAmount: { toString: () => "0" },
      counterparty: {
        id: "cp-1",
        name: "Counterparty LLC",
        taxId: "1234567890",
        legalForm: "LLC",
        address: "Baku",
        isVatPayer: true,
      },
      items: [],
    });
    await expect(service.getExtensionPrefill("org-1", "inv-4")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
