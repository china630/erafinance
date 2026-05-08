import { computeNewOrganizationDemoPeriodEndsAt } from "./subscription-demo-period.util";

describe("computeNewOrganizationDemoPeriodEndsAt", () => {
  it("registration 7 May 2026 UTC -> inclusive through 31 May 2026 23:59:59.999 UTC", () => {
    const from = new Date(Date.UTC(2026, 4, 7, 8, 30, 0));
    const end = computeNewOrganizationDemoPeriodEndsAt(from);
    expect(end.toISOString()).toBe("2026-05-31T23:59:59.999Z");
  });

  it("last day of month -> same month end", () => {
    const from = new Date(Date.UTC(2026, 4, 31, 10, 0, 0));
    const end = computeNewOrganizationDemoPeriodEndsAt(from);
    expect(end.toISOString()).toBe("2026-05-31T23:59:59.999Z");
  });
});
