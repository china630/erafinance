import {
  computeTrialExpiresAtBaku,
  DEFAULT_TRIAL_MODULE_SLUGS,
  TRIAL_3_MONTHS_SLUG,
} from "./trial-package.util";

describe("computeTrialExpiresAtBaku", () => {
  it("adds three calendar months in Baku timezone", () => {
    const signup = new Date("2026-01-15T10:00:00.000Z");
    const end = computeTrialExpiresAtBaku(signup, 3);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baku",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(end);
    expect(parts.find((p) => p.type === "year")?.value).toBe("2026");
    expect(parts.find((p) => p.type === "month")?.value).toBe("04");
    expect(parts.find((p) => p.type === "day")?.value).toBe("15");
  });
});

describe("DEFAULT_TRIAL_MODULE_SLUGS", () => {
  it("excludes paid government and compliance add-ons", () => {
    const slugs = new Set(DEFAULT_TRIAL_MODULE_SLUGS);
    expect(slugs.has("tax_pro")).toBe(false);
    expect(slugs.has("trade_pro")).toBe(false);
    expect(slugs.has("compliance_pro")).toBe(false);
    expect(slugs.has("manufacturing")).toBe(true);
  });
});

describe("TRIAL_3_MONTHS_SLUG", () => {
  it("is stable", () => {
    expect(TRIAL_3_MONTHS_SLUG).toBe("TRIAL_3_MONTHS");
  });
});
