import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemCatalogController } from "./system-catalog.controller";

@Module({
  imports: [PrismaModule],
  controllers: [SystemCatalogController],
})
export class SystemCatalogModule {}
