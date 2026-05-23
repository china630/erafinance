import { Module, forwardRef } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AccessControlModule } from "../access/access-control.module";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { BillingPublicController } from "./billing-public.controller";
import { BillingWebhooksController } from "./billing-webhooks.controller";
import { BillingController } from "./billing.controller";
import { BillingPaymentOrdersService } from "./billing-payment-orders.service";
import { BillingPlatformService } from "./billing-platform.service";
import { BillingService } from "./billing.service";
import { BillingMonthlyQueueService } from "./billing-monthly.queue";
import { BillingMonthlyWorker } from "./billing-monthly.worker";
import { BillingMonthlyService } from "./billing-monthly.service";
import { BillingNotificationService } from "./billing-notification.service";
import { BillingPremiumActivationService } from "./billing-premium-activation.service";
import { BillingMeterService } from "./billing-meter.service";
import { BillingSettlementService } from "./billing-settlement.service";
import { BillingToggleService } from "./billing-toggle.service";
import { BillingBundleToggleService } from "./billing-bundle-toggle.service";
import { BillingEntitlementService } from "./billing-entitlement.service";
import { OrganizationModuleService } from "./organization-module.service";
import { OrganizationBundleService } from "./organization-bundle.service";
import { PaymentProviderService } from "./payment-provider.service";
import { PashaBankPaymentProvider } from "./providers/pasha-bank-payment.provider";

import { DrakarisModule } from "../integrations/payment-providers/drakaris/drakaris.module";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [
    PrismaModule,
    ReferralsModule,
    SystemConfigModule,
    AccessControlModule,
    AdminModule,
    AuditModule,
    forwardRef(() => DrakarisModule),
  ],
  controllers: [BillingController, BillingPublicController, BillingWebhooksController],
  providers: [
    BillingService,
    BillingPlatformService,
    BillingPaymentOrdersService,
    OrganizationModuleService,
    OrganizationBundleService,
    BillingEntitlementService,
    BillingBundleToggleService,
    PaymentProviderService,
    PashaBankPaymentProvider,
    BillingToggleService,
    BillingBundleToggleService,
    BillingEntitlementService,
    BillingNotificationService,
    BillingMonthlyService,
    BillingMonthlyQueueService,
    BillingMonthlyWorker,
    BillingPremiumActivationService,
    BillingMeterService,
    BillingSettlementService,
  ],
  exports: [
    BillingService,
    BillingPlatformService,
    PaymentProviderService,
    BillingPremiumActivationService,
    BillingMeterService,
    BillingSettlementService,
  ],
})
export class BillingModule {}
