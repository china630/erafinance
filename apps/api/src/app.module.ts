import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { apiEnvFilePaths } from "./load-env-paths";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { AccountingModule } from "./accounting/accounting.module";
import { AccountsModule } from "./accounts/accounts.module";
import { AppController } from "./app.controller";
import { AuditModule } from "./audit/audit.module";
import { AuditHubModule } from "./audit-hub/audit-hub.module";
import { AuditEngagementResolveGuard } from "./audit-hub/audit-engagement-resolve.guard";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { ControlPlaneAuthGuard } from "./common/guards/control-plane-auth.guard";
import { AuditorMutationGuard } from "./auth/guards/auditor-mutation.guard";
import { SubscriptionReadOnlyGuard } from "./subscription/subscription-read-only.guard";
import { ControlPlaneEntitlementGuard } from "./control-plane/control-plane-entitlement.guard";
import { ControlPlaneModule } from "./control-plane/control-plane.module";
import { BankingModule } from "./banking/banking.module";
import { ComplianceModule } from "./compliance/compliance.module";
import { CounterpartiesModule } from "./counterparties/counterparties.module";
import { FinanceModule } from "./finance/finance.module";
import { FxModule } from "./fx/fx.module";
import { FixedAssetsModule } from "./fixed-assets/fixed-assets.module";
import { MigrationModule } from "./migration/migration.module";
import { HrModule } from "./hr/hr.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { InventoryModule } from "./inventory/inventory.module";
import { ManufacturingModule } from "./manufacturing/manufacturing.module";
import { PsaModule } from "./psa/psa.module";
import { MailModule } from "./mail/mail.module";
import { ReportingModule } from "./reporting/reporting.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { KassaModule } from "./kassa/kassa.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SubscriptionModule } from "./subscription/subscription.module";
import { QuotaModule } from "./quota/quota.module";
import { PrepaidModule } from "./prepaid/prepaid.module";
import { ProductsModule } from "./products/products.module";
import { StorageModule } from "./storage/storage.module";
import { TaxModule } from "./tax/tax.module";
import { BillingModule } from "./billing/billing.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { AdminModule } from "./admin/admin.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { TenantContextInterceptor } from "./prisma/tenant-context.interceptor";
import { VoenIntegrityGuard } from "./auth/guards/voen-integrity.guard";
import { TreasuryModule } from "./treasury/treasury.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationModule } from "./notifications/notification.module";
import { OcrModule } from "./ocr/ocr.module";
import { CustomsModule } from "./customs/customs.module";
import { SystemCatalogModule } from "./system-catalog/system-catalog.module";
import { EarlyAccessModule } from "./early-access/early-access.module";
import { PlatformRecoveryModule } from "./platform-recovery/platform-recovery.module";
import { DisputeFreezeGuard } from "./platform-recovery/dispute/dispute-freeze.guard";
import { SatelliteIntegrationModule } from "./integration/integration.module";

const apiEnvFiles = apiEnvFilePaths();
const useControlPlaneAuth =
  (process.env.ERA_AUTH_MODE ?? "legacy").toLowerCase() === "control-plane";

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: apiEnvFiles.length ? apiEnvFiles : [".env"],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 600 }],
    }),
    AuthModule,
    MailModule,
    PrismaModule,
    ControlPlaneModule,
    SubscriptionModule,
    BillingModule,
    ReferralsModule,
    QuotaModule,
    StorageModule,
    AccountingModule,
    FinanceModule,
    AccountsModule,
    CounterpartiesModule,
    ProductsModule,
    PrepaidModule,
    InventoryModule,
    FixedAssetsModule,
    MigrationModule,
    ManufacturingModule,
    PsaModule,
    InvoicesModule,
    BankingModule,
    KassaModule,
    FxModule,
    HrModule,
    ReportingModule,
    IntegrationsModule,
    TaxModule,
    AuditModule,
    AuditHubModule,
    ComplianceModule,
    AdminModule,
    OrganizationsModule,
    TreasuryModule,
    ReportsModule,
    NotificationModule,
    OcrModule,
    CustomsModule,
    SystemCatalogModule,
    EarlyAccessModule,
    PlatformRecoveryModule,
    SatelliteIntegrationModule,
  ],
  controllers: [AppController],
  providers: [
    VoenIntegrityGuard,
    ControlPlaneAuthGuard,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: useControlPlaneAuth ? ControlPlaneAuthGuard : JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuditEngagementResolveGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DisputeFreezeGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionReadOnlyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ControlPlaneEntitlementGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuditorMutationGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}
