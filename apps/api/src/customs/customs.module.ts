import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { CounterpartiesModule } from "../counterparties/counterparties.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { CustomsController } from "./customs.controller";
import { CustomsService } from "./customs.service";
import { CustomsTariffRatesService } from "./customs-tariff-rates.service";
import { CustomsTaxCalculatorService } from "./customs-tax-calculator.service";

@Module({
  imports: [AccountingModule, IntegrationsModule, CounterpartiesModule],
  controllers: [CustomsController],
  providers: [CustomsService, CustomsTariffRatesService, CustomsTaxCalculatorService],
  exports: [CustomsService, CustomsTariffRatesService],
})
export class CustomsModule {}
