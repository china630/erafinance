import { ConfigService } from "@nestjs/config";
import {
  PaymentOrderStatus,
  TariffTier,
} from "@erafinance/database";
import { PaymentProviderService } from "../../../billing/payment-provider.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { SystemConfigService } from "../../../system-config/system-config.service";
import { DrakarisService } from "./drakaris.service";
import { DrakarisStatus } from "./drakaris-status";

describe("DrakarisService", () => {
  let service: DrakarisService;
  let prisma: {
    organization: { findFirst: jest.Mock };
    paymentOrder: {
      aggregate: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let config: jest.Mocked<Pick<ConfigService, "get">>;
  let systemConfig: jest.Mocked<Pick<SystemConfigService, "getBillingPriceAzn">>;
  let paymentProvider: jest.Mocked<
    Pick<PaymentProviderService, "finalizePaidOrderPublic">
  >;

  beforeEach(() => {
    prisma = {
      organization: {
        findFirst: jest.fn(),
      },
      paymentOrder: {
        aggregate: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    config = {
      get: jest.fn(),
    } as unknown as jest.Mocked<Pick<ConfigService, "get">>;

    systemConfig = {
      getBillingPriceAzn: jest.fn(),
    };

    paymentProvider = {
      finalizePaidOrderPublic: jest.fn(),
    };

    service = new DrakarisService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      systemConfig as unknown as SystemConfigService,
      paymentProvider as unknown as PaymentProviderService,
    );
  });

  it("checkClient returns 402 when globally disabled", async () => {
    config.get.mockImplementation(() => "0");
    const res = await service.checkClient("ABC123");
    expect(res.status).toBe(DrakarisStatus.PAYMENTS_DISABLED);
    expect(res.data).toBeNull();
  });

  it("checkClient returns 401 when org not found", async () => {
    config.get.mockImplementation((key: string, def?: string) => {
      if (key === "DRAKARIS_ENABLED") return "1";
      return def ?? "";
    });
    prisma.organization.findFirst.mockResolvedValue(null);

    const res = await service.checkClient("ABC123");
    expect(res.status).toBe(DrakarisStatus.INVALID_CLIENT_ID);
  });

  it("checkClient returns 200 with masked name", async () => {
    config.get.mockImplementation((key: string, def?: string) => {
      if (key === "DRAKARIS_ENABLED") return "1";
      return def ?? "";
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: "org-1",
      currency: "AZN",
      settings: {},
      drakarisClientId: "ABC123",
      owner: {
        firstNameCipher: null,
        lastNameCipher: null,
      },
      subscription: { tier: TariffTier.TIER_1 },
    } as never);
    prisma.paymentOrder.aggregate.mockResolvedValue({
      _sum: { amountAzn: null },
    } as never);

    const res = await service.checkClient("ABC123");
    expect(res.status).toBe(DrakarisStatus.OK);
    const data = res.data as { name: string; currency: string };
    expect(data.name).toBeDefined();
    expect(data.currency).toBe("AZN");
  });

  it("topUpBalance returns 407 on currency mismatch", async () => {
    config.get.mockImplementation((key: string, def?: string) => {
      if (key === "DRAKARIS_ENABLED") return "1";
      return def ?? "";
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: "org-1",
      currency: "AZN",
      settings: {},
      drakarisClientId: "ABC123",
      owner: null,
      subscription: { tier: TariffTier.TIER_1 },
    } as never);

    const res = await service.topUpBalance("ABC123", {
      id: "ABC123",
      amount: 10000,
      currency: "USD",
      "transaction-id": "tx-1",
    });
    expect(res.status).toBe(DrakarisStatus.CURRENCY_MISMATCH);
  });

  it("topUpBalance returns 406 when order already paid", async () => {
    config.get.mockImplementation((key: string, def?: string) => {
      if (key === "DRAKARIS_ENABLED") return "1";
      return def ?? "";
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: "org-1",
      currency: "AZN",
      settings: {},
      drakarisClientId: "ABC123",
      owner: null,
      subscription: { tier: TariffTier.TIER_1 },
    } as never);
    prisma.paymentOrder.findUnique.mockResolvedValue({
      id: "order-1",
      status: PaymentOrderStatus.PAID,
    } as never);

    const res = await service.topUpBalance("ABC123", {
      id: "ABC123",
      amount: 10000,
      currency: "AZN",
      "transaction-id": "tx-dup",
    });
    expect(res.status).toBe(DrakarisStatus.DUPLICATE_TRANSACTION);
  });

  it("topUpBalance creates order and finalizes on success", async () => {
    config.get.mockImplementation((key: string, def?: string) => {
      if (key === "DRAKARIS_ENABLED") return "1";
      return def ?? "";
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: "org-1",
      currency: "AZN",
      settings: {},
      drakarisClientId: "ABC123",
      owner: null,
      subscription: { tier: TariffTier.TIER_1 },
    } as never);
    prisma.paymentOrder.findUnique.mockResolvedValue(null);
    systemConfig.getBillingPriceAzn.mockResolvedValue(50);
    prisma.paymentOrder.create.mockResolvedValue({
      id: "new-order",
    } as never);

    const res = await service.topUpBalance("ABC123", {
      id: "ABC123",
      amount: 10000,
      currency: "AZN",
      "transaction-id": "tx-new",
    });

    expect(res.status).toBe(DrakarisStatus.OK);
    expect(prisma.paymentOrder.create).toHaveBeenCalled();
    expect(paymentProvider.finalizePaidOrderPublic).toHaveBeenCalledWith(
      "new-order",
    );
  });

  it("topUpBalance returns 408 on invalid amount", async () => {
    config.get.mockImplementation((key: string, def?: string) => {
      if (key === "DRAKARIS_ENABLED") return "1";
      return def ?? "";
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: "org-1",
      currency: "AZN",
      settings: {},
      drakarisClientId: "ABC123",
      owner: null,
      subscription: { tier: TariffTier.TIER_1 },
    } as never);

    const res = await service.topUpBalance("ABC123", {
      id: "ABC123",
      amount: -1,
      currency: "AZN",
      "transaction-id": "tx-bad",
    });
    expect(res.status).toBe(DrakarisStatus.VALIDATION_ERROR);
  });
});

