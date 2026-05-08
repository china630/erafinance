import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccountingController } from "./accounting.controller";
import { AccountingService } from "./accounting.service";
import { BankSubaccountService } from "./bank-subaccount.service";
import { IfrsAutoMappingService } from "./ifrs-auto-mapping.service";
import { NettingService } from "./netting.service";

@Module({
  controllers: [AccountingController],
  providers: [
    AccountingService,
    BankSubaccountService,
    IfrsAutoMappingService,
    NettingService,
    RolesGuard,
  ],
  exports: [AccountingService, BankSubaccountService, NettingService],
})
export class AccountingModule {}
