import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StockModule } from "../stock/stock.module";
import { ManufacturingController } from "./manufacturing.controller";
import { ManufacturingOverheadController } from "./manufacturing-overhead.controller";
import { ManufacturingOverheadService } from "./manufacturing-overhead.service";
import { ManufacturingService } from "./manufacturing.service";
import { ManufacturingOrderService } from "./manufacturing-order.service";

@Module({
  imports: [PrismaModule, AccountingModule, StockModule],
  controllers: [ManufacturingController, ManufacturingOverheadController],
  providers: [
    ManufacturingService,
    ManufacturingOverheadService,
    ManufacturingOrderService,
  ],
})
export class ManufacturingModule {}
