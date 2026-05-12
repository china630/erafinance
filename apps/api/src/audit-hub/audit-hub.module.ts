import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditModule } from "../audit/audit.module";
import { AuditBulkExportService } from "./audit-bulk-export.service";
import { AuditEngagementGuestAccessLogInterceptor } from "./audit-engagement-guest-access-log.interceptor";
import { AuditEngagementInviteService } from "./audit-engagement-invite.service";
import { AuditEngagementResolveGuard } from "./audit-engagement-resolve.guard";
import { AuditEngagementService } from "./audit-engagement.service";
import { AuditHubBackdatingService } from "./audit-hub-backdating.service";
import { AuditHubCalculationService } from "./audit-hub-calculation.service";
import { AuditHubController } from "./audit-hub.controller";
import { AuditHubMeController } from "./audit-hub-me.controller";
import { AuditHubNasIfrsService } from "./audit-hub-nas-ifrs.service";
import { AuditHubRiskService } from "./audit-hub-risk.service";
import { AuditHubSummaryService } from "./audit-hub-summary.service";
import { AuditSamplingService } from "./audit-sampling.service";
import { AuditTimelineService } from "./audit-timeline.service";

@Module({
  imports: [AuditModule],
  controllers: [AuditHubController, AuditHubMeController],
  providers: [
    AuditTimelineService,
    AuditHubBackdatingService,
    AuditSamplingService,
    AuditBulkExportService,
    AuditHubSummaryService,
    AuditHubNasIfrsService,
    AuditHubRiskService,
    AuditHubCalculationService,
    AuditEngagementService,
    AuditEngagementInviteService,
    AuditEngagementResolveGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditEngagementGuestAccessLogInterceptor,
    },
  ],
  exports: [AuditEngagementInviteService, AuditEngagementResolveGuard],
})
export class AuditHubModule {}
