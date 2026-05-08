import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PrepaidExpensesController } from "./prepaid-expenses.controller";
import { PrepaidExpensesService } from "./prepaid-expenses.service";

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [PrepaidExpensesController],
  providers: [PrepaidExpensesService],
  exports: [PrepaidExpensesService],
})
export class PrepaidModule {}
