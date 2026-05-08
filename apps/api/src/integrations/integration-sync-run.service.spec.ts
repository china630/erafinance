import { IntegrationSyncRunService } from "./integration-sync-run.service";

describe("IntegrationSyncRunService", () => {
  it("starts and completes run via raw SQL", async () => {
    const prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    const service = new IntegrationSyncRunService(prisma as never);
    const runId = await service.start({
      organizationId: "00000000-0000-0000-0000-000000000001",
      portal: "DVX",
      flow: "eqaime",
      transport: "RPA_WIDGET",
      totalCount: 2,
    });
    expect(runId).toBeTruthy();
    await service.complete({ runId, successCount: 1, errorCount: 1 });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
