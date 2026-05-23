import { Global, Module, forwardRef } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { QuotaGuard } from "../common/guards/quota.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { QuotaService } from "./quota.service";

@Global()
@Module({
  imports: [PrismaModule, SystemConfigModule, forwardRef(() => BillingModule)],
  providers: [QuotaService, QuotaGuard],
  exports: [QuotaService, QuotaGuard],
})
export class QuotaModule {}
