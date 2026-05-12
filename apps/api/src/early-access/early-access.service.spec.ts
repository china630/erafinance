import {
  EarlyAccessEventType,
  EarlyAccessModuleKey,
  UserRole,
} from "@erafinance/database";
import { EarlyAccessService } from "./early-access.service";
import type { AuthUser } from "../auth/types/auth-user";

describe("EarlyAccessService", () => {
  const user: AuthUser = {
    userId: "u1",
    email: "a@b.c",
    organizationId: "o1",
    role: UserRole.OWNER,
  };

  const req = {
    ip: "127.0.0.1",
    headers: {},
  } as never;

  it("signup upserts in transaction and fires threshold alert when count crosses configured threshold", async () => {
    const thresholdCreates: Array<{ moduleKey: string; threshold: number }> =
      [];
    let signupCount = 0;

    const earlyAccessSignup = {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockImplementation(async () => signupCount),
    };
    const earlyAccessEvent = {
      create: jest.fn().mockResolvedValue({ id: "e1" }),
    };

    const prisma = {
      earlyAccessSignup,
      earlyAccessEvent,
      earlyAccessThresholdAlert: {
        create: jest.fn().mockImplementation(async (args: {
          data: { moduleKey: string; threshold: number };
        }) => {
          thresholdCreates.push({
            moduleKey: args.data.moduleKey,
            threshold: args.data.threshold,
          });
        }),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: "admin1", email: "admin@test" }]),
      },
      notification: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        await cb({
          earlyAccessSignup,
          earlyAccessEvent,
        });
      }),
    };

    signupCount = 50;

    const access = {
      getOrganizationSnapshot: jest.fn().mockResolvedValue({
        tier: "STARTER",
        activeModules: [],
        customConfig: null,
        modules: {},
        expiresAt: null,
        isTrial: false,
      }),
    };

    const mail = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const config = {
      get: jest.fn().mockReturnValue("50"),
    };

    const svc = new EarlyAccessService(
      prisma as never,
      access as never,
      mail as never,
      config as never,
    );

    await svc.signup(
      user,
      {
        moduleKey: EarlyAccessModuleKey.RETAIL_ECOM,
        industry: "retail",
        surveyAnswer: "Stock sync",
      },
      req,
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(earlyAccessSignup.upsert).toHaveBeenCalled();
    expect(earlyAccessEvent.create).toHaveBeenCalled();
    expect(thresholdCreates).toEqual([{ moduleKey: "RETAIL_ECOM", threshold: 50 }]);
    expect(mail.sendMail).toHaveBeenCalled();
  });

  it("recordEvent rejects MODAL_CLOSE without durationMs", async () => {
    const prisma = {
      earlyAccessEvent: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const access = { getOrganizationSnapshot: jest.fn() };
    const mail = { sendMail: jest.fn() };
    const config = { get: jest.fn() };
    const svc = new EarlyAccessService(
      prisma as never,
      access as never,
      mail as never,
      config as never,
    );
    await expect(
      svc.recordEvent(
        user,
        {
          moduleKey: EarlyAccessModuleKey.CRM_WHATSAPP,
          eventType: EarlyAccessEventType.MODAL_CLOSE,
          sessionId: "550e8400-e29b-41d4-a716-446655440000",
        },
        req,
      ),
    ).rejects.toBeDefined();
    expect(prisma.earlyAccessEvent.create).not.toHaveBeenCalled();
  });

  it("getAdminSummary returns four modules with computed fields", async () => {
    const prisma = {
      earlyAccessSignup: {
        groupBy: jest.fn().mockResolvedValue([
          {
            moduleKey: EarlyAccessModuleKey.RETAIL_ECOM,
            _count: { _all: 1 },
            _min: { createdAt: new Date("2026-05-01T00:00:00Z") },
          },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        { module_key: EarlyAccessModuleKey.RETAIL_ECOM, c: 2n },
      ]),
      earlyAccessEvent: {
        findMany: jest.fn().mockResolvedValue([
          { moduleKey: EarlyAccessModuleKey.RETAIL_ECOM, durationMs: 1000 },
          { moduleKey: EarlyAccessModuleKey.RETAIL_ECOM, durationMs: 3000 },
        ]),
      },
      earlyAccessThresholdAlert: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const access = { getOrganizationSnapshot: jest.fn() };
    const mail = { sendMail: jest.fn() };
    const config = { get: jest.fn().mockReturnValue("50") };
    const svc = new EarlyAccessService(
      prisma as never,
      access as never,
      mail as never,
      config as never,
    );

    const summary = await svc.getAdminSummary();
    expect(summary).toHaveLength(4);
    const retail = summary.find((s) => s.moduleKey === EarlyAccessModuleKey.RETAIL_ECOM);
    expect(retail?.signupsCount).toBe(1);
    expect(retail?.viewersCount).toBe(2);
    expect(retail?.medianModalCloseMs).toBe(2000);
  });
});
