import { ConfigService } from "@nestjs/config";
import {
  referralCommissionTierRate,
  ReferralsService,
} from "./referrals.service";

describe("referralCommissionTierRate", () => {
  it("returns 10% below 10 referred orgs", () => {
    expect(referralCommissionTierRate(0)).toBe(10);
    expect(referralCommissionTierRate(9)).toBe(10);
  });
  it("returns 15% from 10 to 49", () => {
    expect(referralCommissionTierRate(10)).toBe(15);
    expect(referralCommissionTierRate(49)).toBe(15);
  });
  it("returns 20% from 50 upward", () => {
    expect(referralCommissionTierRate(50)).toBe(20);
    expect(referralCommissionTierRate(100)).toBe(20);
  });
});

describe("ReferralsService.deactivateExpiredReferrals", () => {
  it("calls updateMany with windowEndsAt lt now", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { referral: { updateMany } } as never;
    const config = { get: jest.fn() } as unknown as ConfigService;
    const svc = new ReferralsService(prisma, config);
    const now = new Date("2026-06-01T00:00:00.000Z");
    const n = await svc.deactivateExpiredReferrals(now);
    expect(n).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: { isActive: true, windowEndsAt: { lt: now } },
      data: { isActive: false },
    });
  });
});
