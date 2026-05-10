import { Module, forwardRef } from "@nestjs/common";
import { BillingModule } from "../../../billing/billing.module";
import { PrismaModule } from "../../../prisma/prisma.module";
import { DrakarisController } from "./drakaris.controller";
import { DrakarisPaymentProvider } from "./drakaris-payment.provider";
import { DrakarisService } from "./drakaris.service";

@Module({
  imports: [PrismaModule, forwardRef(() => BillingModule)],
  controllers: [DrakarisController],
  providers: [DrakarisService, DrakarisPaymentProvider],
  exports: [DrakarisService, DrakarisPaymentProvider],
})
export class DrakarisModule {}
