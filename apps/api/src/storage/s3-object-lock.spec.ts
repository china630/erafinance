import { objectLockRetainUntilForKey } from "./storage.constants";

describe("objectLockRetainUntilForKey", () => {
  it("returns a future date for invoices/pdf prefix", () => {
    const d = objectLockRetainUntilForKey("invoices/pdf/org/x.pdf");
    expect(d).toBeDefined();
    expect(d!.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns undefined for unrelated keys", () => {
    expect(objectLockRetainUntilForKey("tmp/foo")).toBeUndefined();
  });

  it("prefers longest matching prefix", () => {
    const d = objectLockRetainUntilForKey("evidence/case-1/file.bin");
    expect(d).toBeDefined();
  });
});
