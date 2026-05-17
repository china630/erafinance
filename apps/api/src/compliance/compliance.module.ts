import { Module } from "@nestjs/common";
import { NotificationModule } from "../notifications/notification.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import {
  CounterpartyVoenScanner,
  FraudPatternsScanner,
} from "./compliance-scanners.service";
import { ComplianceRiskQueueService } from "./compliance-risk.queue";
import { ComplianceRiskWorker } from "./compliance-risk.worker";
import { TaxLimitService } from "./tax-limit.service";
import { GeminiCouncilClient } from "./council/gemini-council.client";
import { CouncilConsensusReducer } from "./council/council-consensus.reducer";
import { CouncilElderAgents } from "./council/council-elder.agents";
import { CouncilSynthesizerService } from "./council/council-synthesizer.service";
import { CouncilSnapshotBuilderService } from "./council/council-snapshot-builder.service";
import { CouncilDispatcherService } from "./council/council-dispatcher.service";
import { CouncilEngineService } from "./council/council-engine.service";
import { CouncilQueueService } from "./council/council.queue";
import { CouncilWorker } from "./council/council.worker";
import { CouncilTriggerService } from "./council/council-trigger.service";
import { CouncilQuotaService } from "./council/council-quota.service";
import { CouncilFacadeService } from "./council/council-facade.service";

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    TaxLimitService,
    CounterpartyVoenScanner,
    FraudPatternsScanner,
    ComplianceRiskQueueService,
    ComplianceRiskWorker,
    GeminiCouncilClient,
    CouncilConsensusReducer,
    CouncilElderAgents,
    CouncilSynthesizerService,
    CouncilSnapshotBuilderService,
    CouncilDispatcherService,
    CouncilEngineService,
    CouncilQueueService,
    CouncilWorker,
    CouncilTriggerService,
    CouncilQuotaService,
    CouncilFacadeService,
  ],
  exports: [ComplianceService, TaxLimitService, CouncilTriggerService, CouncilFacadeService],
})
export class ComplianceModule {}
