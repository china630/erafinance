import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Worker } from "bullmq";
import { attachWorkerFailureAlert } from "../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { REFERRAL_MONTHLY_QUEUE } from "./referrals.constants";
import { ReferralsService } from "./referrals.service";

@Injectable()
export class ReferralMonthlyWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReferralMonthlyWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly referrals: ReferralsService,
  ) {}

  onModuleInit(): void {
    if (process.env.REFERRAL_MONTHLY_DISABLED === "1") {
      this.logger.warn("REFERRAL_MONTHLY_DISABLED=1 — referral monthly worker off");
      return;
    }
    const connection = connectionFromRedisUrl(
      this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.worker = new Worker(
      REFERRAL_MONTHLY_QUEUE,
      async (job: Job) => this.handle(job),
      { connection },
    );
    attachWorkerFailureAlert(
      this.worker,
      REFERRAL_MONTHLY_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ?? undefined,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job): Promise<void> {
    if (job.name !== "referral_monthly_expire") {
      return;
    }
    const n = await this.referrals.deactivateExpiredReferrals(new Date());
    this.logger.log(`Referral expiry job: deactivated ${n} referral(s)`);
  }
}
