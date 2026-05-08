import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomsModule } from "../customs/customs.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { AdminCustomsTariffRatesController } from "./admin-customs-tariff-rates.controller";
import { AdminAuditLogsController } from "./admin-audit-logs.controller";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminAuditLogsService } from "./audit.service";
import { PricingService } from "./pricing.service";
import { PublicTranslationsController } from "./public-translations.controller";

@Module({
  imports: [PrismaModule, SystemConfigModule, AuthModule, CustomsModule],
  controllers: [
    AdminController,
    AdminAuditLogsController,
    AdminCustomsTariffRatesController,
    PublicTranslationsController,
  ],
  providers: [AdminService, AdminAuditLogsService, PricingService],
  exports: [AdminService, PricingService],
})
export class AdminModule {}
