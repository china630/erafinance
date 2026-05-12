import { Prisma } from "@erafinance/database";
import {
  computeVacationBalance,
  elapsedDaysSinceHire,
  inclusiveCalendarDays,
} from "../../src/hr/vacation-balance.util";

const D = Prisma.Decimal;

describe("vacation-balance.util", () => {
  it("elapsedDaysSinceHire: same day => 0", () => {
    const d = new Date(Date.UTC(2025, 0, 15));
    expect(elapsedDaysSinceHire(d, d)).toBe(0);
  });

  it("elapsedDaysSinceHire: next day => 1", () => {
    const hire = new Date(Date.UTC(2025, 0, 15));
    const asOf = new Date(Date.UTC(2025, 0, 16));
    expect(elapsedDaysSinceHire(hire, asOf)).toBe(1);
  });

  it("inclusiveCalendarDays: single day => 1", () => {
    const d = new Date(Date.UTC(2025, 3, 1));
    expect(inclusiveCalendarDays(d, d)).toBe(1);
  });

  it("inclusiveCalendarDays: week span", () => {
    const a = new Date(Date.UTC(2025, 3, 1));
    const b = new Date(Date.UTC(2025, 3, 7));
    expect(inclusiveCalendarDays(a, b)).toBe(7);
  });

  it("computeVacationBalance: 365 days, 21 base, no initial, no used => 21", () => {
    const hire = new Date(Date.UTC(2025, 0, 1));
    const asOf = new Date(Date.UTC(2026, 0, 1));
    expect(elapsedDaysSinceHire(hire, asOf)).toBe(365);
    const bal = computeVacationBalance({
      hireDate: hire,
      asOf,
      initialVacationDays: new D(0),
      baseVacationDaysPerYear: 21,
      usedLaborLeaveDays: new D(0),
    });
    expect(bal.toFixed(2)).toBe("21.00");
  });

  it("computeVacationBalance: subtracts LABOR_LEAVE days", () => {
    const hire = new Date(Date.UTC(2025, 0, 1));
    const asOf = new Date(Date.UTC(2026, 0, 1));
    const bal = computeVacationBalance({
      hireDate: hire,
      asOf,
      initialVacationDays: new D(0),
      baseVacationDaysPerYear: 21,
      usedLaborLeaveDays: new D(5),
    });
    expect(bal.toFixed(2)).toBe("16.00");
  });
});
