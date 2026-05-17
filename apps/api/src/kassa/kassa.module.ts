import { Module, forwardRef } from "@nestjs/common";
import { ComplianceModule } from "../compliance/compliance.module";
import { AccountingModule } from "../accounting/accounting.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReportingModule } from "../reporting/reporting.module";
import { TreasuryModule } from "../treasury/treasury.module";
import { CashDeskController } from "./cash-desk.controller";
import { CashOrderService } from "./cash-order.service";

@Module({
  imports: [
    PrismaModule,
    AccountingModule,
    ReportingModule,
    TreasuryModule,
    ApprovalsModule,
    forwardRef(() => ComplianceModule),
  ],
  controllers: [CashDeskController],
  providers: [CashOrderService],
  exports: [CashOrderService],
})
export class KassaModule {}
