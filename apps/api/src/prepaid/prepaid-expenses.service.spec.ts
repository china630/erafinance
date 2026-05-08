import { enumerateMonthKeys } from "./prepaid-expenses.service";

describe("enumerateMonthKeys", () => {
  it("returns inclusive months", () => {
    const start = new Date(Date.UTC(2025, 0, 15, 0, 0, 0, 0));
    const end = new Date(Date.UTC(2025, 2, 10, 0, 0, 0, 0));
    expect(enumerateMonthKeys(start, end)).toEqual(["2025-01", "2025-02", "2025-03"]);
  });
});
