import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminEarlyAccessController } from "./admin-early-access.controller";
import { EarlyAccessController } from "./early-access.controller";
import { EarlyAccessService } from "./early-access.service";

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [EarlyAccessController, AdminEarlyAccessController],
  providers: [EarlyAccessService],
})
export class EarlyAccessModule {}
