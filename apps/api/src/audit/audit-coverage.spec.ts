import {
  loadEntitySnapshotForAudit,
  matchAuditSnapshotPath,
} from "./audit-entity-snapshot";

describe("audit entity snapshot (R1.3)", () => {
  describe("matchAuditSnapshotPath", () => {
    it("maps invoice PATCH", () => {
      expect(matchAuditSnapshotPath("/invoices/u1", "PATCH")).toEqual({
        entityType: "Invoice",
        entityId: "u1",
      });
    });

    it("maps nested invoice route", () => {
      expect(matchAuditSnapshotPath("/invoices/u1/send", "PATCH")).toEqual({
        entityType: "Invoice",
        entityId: "u1",
      });
    });

    it("maps employee DELETE", () => {
      expect(matchAuditSnapshotPath("/hr/employees/e1", "DELETE")).toEqual({
        entityType: "Employee",
        entityId: "e1",
      });
    });

    it("returns null for POST", () => {
      expect(matchAuditSnapshotPath("/invoices/u1", "POST")).toBeNull();
    });
  });

  describe("loadEntitySnapshotForAudit", () => {
    it("dispatches to invoice delegate with includes", async () => {
      const findFirst = jest.fn().mockResolvedValue({ id: "i1" });
      const prisma = { invoice: { findFirst } } as never;
      const row = await loadEntitySnapshotForAudit(
        prisma,
        "Invoice",
        "org-1",
        "i1",
      );
      expect(row).toEqual({ id: "i1" });
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "i1", organizationId: "org-1" },
        include: { items: true, payments: true },
      });
    });

    it("returns null for unknown entity type", async () => {
      const prisma = {} as never;
      await expect(
        loadEntitySnapshotForAudit(prisma, "UnknownModel", "o", "x"),
      ).resolves.toBeNull();
    });
  });
});
