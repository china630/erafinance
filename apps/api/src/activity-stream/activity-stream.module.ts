import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notifications/notification.module";
import { ActivityStreamController } from "./activity-stream.controller";
import { ActivityStreamEmitterService } from "./activity-stream-emitter.service";
import { ActivityStreamService } from "./activity-stream.service";

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ActivityStreamController],
  providers: [ActivityStreamService, ActivityStreamEmitterService],
  exports: [ActivityStreamEmitterService, ActivityStreamService],
})
export class ActivityStreamModule {}
