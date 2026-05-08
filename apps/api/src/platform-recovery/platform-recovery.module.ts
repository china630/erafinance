import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";
import { NotificationModule } from "../notifications/notification.module";
import { StepUpAuthService } from "./step-up/step-up-auth.service";
import { StepUpAdminController } from "./step-up/step-up.admin.controller";
import { StepUpGuard } from "./step-up/step-up.guard";
import { DualApprovalService } from "./dual-approval/dual-approval.service";
import { DualApprovalAdminController } from "./dual-approval/dual-approval.admin.controller";
import { DualApprovalGuard } from "./dual-approval/dual-approval.guard";
import { DisputeService } from "./dispute/dispute.service";
import { DisputeFreezeGuard } from "./dispute/dispute-freeze.guard";
import { DisputeAdminController } from "./dispute/dispute.admin.controller";
import { DisputePublicController } from "./dispute/dispute.public.controller";
import { SnapshotService } from "./snapshot/snapshot.service";
import { LogicalTenantSnapshotWorker } from "./snapshot/snapshot.worker";
import { RollbackService } from "./rollback/rollback.service";
import { PlatformRecoveryAdminController } from "./platform-recovery.admin.controller";
import { TransferCertificateService } from "./dispute/transfer-certificate.service";

@Module({
  imports: [
    PrismaModule,
    MailModule,
    NotificationModule,
    AuditModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: "10m" as const },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    DisputeAdminController,
    DisputePublicController,
    PlatformRecoveryAdminController,
    StepUpAdminController,
    DualApprovalAdminController,
  ],
  providers: [
    StepUpAuthService,
    StepUpGuard,
    DualApprovalService,
    DualApprovalGuard,
    DisputeService,
    SnapshotService,
    LogicalTenantSnapshotWorker,
    RollbackService,
    TransferCertificateService,
    DisputeFreezeGuard,
  ],
  exports: [
    StepUpAuthService,
    DualApprovalService,
    DisputeService,
    SnapshotService,
    RollbackService,
    TransferCertificateService,
    DisputeFreezeGuard,
  ],
})
export class PlatformRecoveryModule {}
