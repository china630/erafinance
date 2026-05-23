import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isSatelliteHotelReservationCompleted } from "@era/contracts";
import { Job, Worker } from "bullmq";
import { attachWorkerFailureAlert } from "../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { PrismaService } from "../prisma/prisma.service";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import {
  ERA_SATELLITE_EVENTS_QUEUE,
  type SatelliteEventJobPayload,
} from "./satellite-event.queue";

/**
 * Consumes `era-satellite-events` from Redis (produced by orchestrator gateway).
 *
 * Planned handler steps (GL/FIFO not implemented in this phase):
 * 1. Parse job → `isSatelliteHotelReservationCompleted()`
 * 2. `runWithTenantContextAsync({ organizationId })`
 * 3. `prisma.$transaction()` → `GeneralLedgerService.postSatelliteRevenue`, `StockService.consumeIfSku`
 * 4. Idempotency via `correlationId` unique table (future migration)
 */
@Injectable()
export class SatelliteEventWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SatelliteEventWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    if (process.env.SATELLITE_EVENT_WORKER_DISABLED === "1") {
      this.logger.warn("SATELLITE_EVENT_WORKER_DISABLED=1 — worker off");
      return;
    }
    const connection = connectionFromRedisUrl(
      this.config.get<string>("SATELLITE_EVENT_REDIS_URL") ??
        this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.worker = new Worker<SatelliteEventJobPayload>(
      ERA_SATELLITE_EVENTS_QUEUE,
      async (job: Job<SatelliteEventJobPayload>) => this.handle(job),
      { connection },
    );
    attachWorkerFailureAlert(
      this.worker,
      ERA_SATELLITE_EVENTS_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ??
        undefined,
    );
    this.logger.log(`Listening on queue ${ERA_SATELLITE_EVENTS_QUEUE}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job<SatelliteEventJobPayload>): Promise<void> {
    const data = job.data;
    if (!isSatelliteHotelReservationCompleted(data)) {
      this.logger.warn(`Job ${job.id}: unknown event shape, skipping`);
      return;
    }

    await runWithTenantContextAsync(
      { organizationId: data.organizationId, skipTenantFilter: false },
      async () => {
        this.logger.log(
          `SATELLITE_HOTEL_RESERVATION_COMPLETED correlation=${data.correlationId} reservation=${data.payload.reservationId} amountNet=${data.payload.amountNet}`,
        );
        // Placeholder: idempotency + GL post inside prisma.$transaction
        await this.prisma.$transaction(async () => {
          // GeneralLedgerService.postSatelliteRevenue(data)
          // StockService.consumeIfSku(data.payload.items)
        });
      },
    );
  }
}
