import { NotImplementedException } from "@nestjs/common";
import { RollbackService } from "./rollback.service";

describe("RollbackService", () => {
  it("restoreToPointInTime throws NotImplemented when snapshot exists", async () => {
    const prisma = {
      organizationDataSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          id: "s1",
          takenAt: new Date("2020-01-01"),
        }),
      },
    } as never;
    const svc = new RollbackService(prisma);
    await expect(svc.restoreToPointInTime("o1", "ignored", "2020-06-01T00:00:00.000Z")).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it("previewRestore returns ok when snapshot exists", async () => {
    const prisma = {
      organizationDataSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          id: "s1",
          organizationId: "o1",
          sha256: "abc",
        }),
      },
      invoice: { count: jest.fn().mockResolvedValue(0) },
      employee: { count: jest.fn().mockResolvedValue(0) },
      counterparty: { count: jest.fn().mockResolvedValue(0) },
    } as never;
    const svc = new RollbackService(prisma);
    const r = await svc.previewRestore("o1", "s1");
    expect(r.ok).toBe(true);
  });
});
