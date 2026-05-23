import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SatelliteEventWorker } from "./satellite-event.worker";

@Module({
  imports: [PrismaModule],
  providers: [SatelliteEventWorker],
})
export class SatelliteIntegrationModule {}
