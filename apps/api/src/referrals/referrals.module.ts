import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminReferralsController } from "./admin-referrals.controller";
import { PartnerReferralsController } from "./partner-referrals.controller";
import { ReferralMonthlyQueueService } from "./referral-monthly.queue";
import { ReferralMonthlyWorker } from "./referral-monthly.worker";
import { ReferralsService } from "./referrals.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminReferralsController, PartnerReferralsController],
  providers: [
    ReferralsService,
    ReferralMonthlyQueueService,
    ReferralMonthlyWorker,
  ],
  exports: [ReferralsService],
})
export class ReferralsModule {}
