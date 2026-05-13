import {
  computeTrialExpiresAtUtc,
  DEFAULT_TRIAL_DURATION_DAYS,
} from "./trial-package.util";

describe("computeTrialExpiresAtUtc", () => {
  it("adds calendar days and ends at 23:59:59.999 UTC", () => {
    const signup = new Date(Date.UTC(2026, 0, 1, 10, 0, 0, 0));
    const end = computeTrialExpiresAtUtc(signup, 90);
    expect(end.getUTCFullYear()).toBe(2026);
    expect(end.getUTCMonth()).toBe(3);
    expect(end.getUTCDate()).toBe(1);
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
    expect(end.getUTCSeconds()).toBe(59);
    expect(end.getUTCMilliseconds()).toBe(999);
  });

  it("defaults to at least 1 day", () => {
    const signup = new Date(Date.UTC(2026, 5, 15, 0, 0, 0, 0));
    const end = computeTrialExpiresAtUtc(signup, 0);
    expect(end.getUTCDate()).toBe(16);
  });

  it("exposes default trial duration constant", () => {
    expect(DEFAULT_TRIAL_DURATION_DAYS).toBe(90);
  });
});
