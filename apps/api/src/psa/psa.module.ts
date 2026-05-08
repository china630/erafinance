import { Module } from "@nestjs/common";
import { InvoicesModule } from "../invoices/invoices.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PsaController } from "./psa.controller";
import { PsaService } from "./psa.service";

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [PsaController],
  providers: [PsaService],
})
export class PsaModule {}
