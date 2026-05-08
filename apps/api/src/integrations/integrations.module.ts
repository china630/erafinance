import { Module } from "@nestjs/common";
import { AccessControlModule } from "../access/access-control.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ExcelBulkController } from "./excel-bulk.controller";
import { ExcelBulkService } from "./excel-bulk.service";
import { IntegrationReliabilityService } from "./integration-reliability.service";
import { IntegrationsHealthController } from "./integrations-health.controller";
import { IntegrationSyncRunService } from "./integration-sync-run.service";
import { TemplatesAssetsService } from "./templates-assets.service";

@Module({
  imports: [AccessControlModule, PrismaModule],
  controllers: [IntegrationsHealthController, ExcelBulkController],
  providers: [
    IntegrationReliabilityService,
    IntegrationSyncRunService,
    TemplatesAssetsService,
    ExcelBulkService,
  ],
  exports: [IntegrationReliabilityService, IntegrationSyncRunService, TemplatesAssetsService],
})
export class IntegrationsModule {}

