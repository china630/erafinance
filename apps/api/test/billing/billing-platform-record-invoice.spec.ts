import {
  BillingStatus,
  PaymentOrderStatus,
  SubscriptionInvoiceStatus,
} from "@erafinance/database";
import { BillingPlatformService } from "../../src/billing/billing-platform.service";

describe("BillingPlatformService.recordPaidOrderInvoice", () => {
  it("returns without creating a second invoice when paymentOrderId already exists", async () => {
    const tx = {
      subscriptionInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: "existing-inv",
          paymentOrderId: "order-1",
        }),
        create: jest.fn(),
      },
      paymentOrder: { findUnique: jest.fn() },
      organization: { update: jest.fn() },
    };

    const prisma = {} as any;
    const pricing = {} as any;
    const subscriptionAccess = {} as any;
    const svc = new BillingPlatformService(prisma, pricing, subscriptionAccess);

    await svc.recordPaidOrderInvoice(tx as any, "order-1");

    expect(tx.subscriptionInvoice.create).not.toHaveBeenCalled();
    expect(tx.paymentOrder.findUnique).not.toHaveBeenCalled();
  });

  it("creates PAID invoice when no duplicate and order is PAID", async () => {
    const tx = {
      subscriptionInvoice: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "new-inv" }),
      },
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: "order-2",
          status: PaymentOrderStatus.PAID,
          organizationId: "org-1",
          amountAzn: { toString: () => "10" },
          paidAt: new Date("2026-01-15T12:00:00.000Z"),
          monthsApplied: 1,
          metadata: {},
          organization: { name: "Acme", taxId: "1234567890" },
        }),
      },
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ userId: "owner-1" }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ ownerId: null }),
        update: jest.fn(),
      },
    };

    const prisma = {} as any;
    const pricing = {} as any;
    const subscriptionAccess = {} as any;
    const svc = new BillingPlatformService(prisma, pricing, subscriptionAccess);

    await svc.recordPaidOrderInvoice(tx as any, "order-2");

    expect(tx.subscriptionInvoice.create).toHaveBeenCalled();
    const arg = tx.subscriptionInvoice.create.mock.calls[0][0];
    expect(arg.data.status).toBe(SubscriptionInvoiceStatus.PAID);
    expect(arg.data.paymentOrderId).toBe("order-2");
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { billingStatus: BillingStatus.ACTIVE },
    });
  });
});
