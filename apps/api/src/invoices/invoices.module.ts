import { Module, forwardRef } from "@nestjs/common";
import { ComplianceModule } from "../compliance/compliance.module";
import { AccountingModule } from "../accounting/accounting.module";
import { InventoryModule } from "../inventory/inventory.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { KassaModule } from "../kassa/kassa.module";
import { SignatureModule } from "../signature/signature.module";
import { InvoicePdfQueueService } from "./invoice-pdf.queue";
import { InvoicePdfWorker } from "./invoice-pdf.worker";
import { InvoiceSignatureController } from "./invoice-signature.controller";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { PublicInvoiceController } from "./public-invoice.controller";

@Module({
  imports: [
    AccountingModule,
    InventoryModule,
    IntegrationsModule,
    KassaModule,
    SignatureModule,
    forwardRef(() => ComplianceModule),
  ],
  controllers: [
    InvoicesController,
    InvoiceSignatureController,
    PublicInvoiceController,
  ],
  providers: [InvoicesService, InvoicePdfQueueService, InvoicePdfWorker],
  exports: [InvoicesService],
})
export class InvoicesModule {}
