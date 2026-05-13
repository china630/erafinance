import { Prisma } from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { DepreciationService } from "./depreciation.service";

describe("DepreciationService", () => {
  const accounting = {} as AccountingService;
  const svc = new DepreciationService(accounting);
  const computeRb = (
    svc as unknown as {
      computeReducingBalanceMonthlyAmount(
        a: {
          purchasePrice: Prisma.Decimal;
          bookedDepreciation: Prisma.Decimal;
          salvageValue: Prisma.Decimal;
          decliningBalanceRate: Prisma.Decimal | null;
        },
        remainingDepreciable: Prisma.Decimal,
      ): Prisma.Decimal | null;
    }
  ).computeReducingBalanceMonthlyAmount.bind(svc);

  it("computes reducing-balance monthly from NBV * annualRate / 12", () => {
    const amount = computeRb(
      {
        purchasePrice: new Prisma.Decimal("1200"),
        bookedDepreciation: new Prisma.Decimal("0"),
        salvageValue: new Prisma.Decimal("200"),
        decliningBalanceRate: new Prisma.Decimal("0.24"),
      },
      new Prisma.Decimal("1000"),
    );
    expect(amount).not.toBeNull();
    expect(amount!.toString()).toBe("24");
  });

  it("caps reducing-balance monthly to remaining depreciable", () => {
    const amount = computeRb(
      {
        purchasePrice: new Prisma.Decimal("310"),
        bookedDepreciation: new Prisma.Decimal("300"),
        salvageValue: new Prisma.Decimal("0"),
        decliningBalanceRate: new Prisma.Decimal("0.5"),
      },
      new Prisma.Decimal("10"),
    );
    expect(amount).not.toBeNull();
    // NBV 10, monthly = 10 * 0.5 / 12 ≈ 0.4167 → rounded; capped by remaining 10
    expect(Number(amount!.toString())).toBeLessThanOrEqual(10);
    expect(Number(amount!.toString())).toBeGreaterThan(0);
  });

  it("returns null when declining balance rate is missing", () => {
    const amount = computeRb(
      {
        purchasePrice: new Prisma.Decimal("1000"),
        bookedDepreciation: new Prisma.Decimal("0"),
        salvageValue: new Prisma.Decimal("0"),
        decliningBalanceRate: null,
      },
      new Prisma.Decimal("1000"),
    );
    expect(amount).toBeNull();
  });
});
