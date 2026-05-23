import { Global, Module } from "@nestjs/common";
import { ControlPlaneClient } from "./control-plane.client";
import { ControlPlaneEntitlementGuard } from "./control-plane-entitlement.guard";
import { ControlPlanePrismaService } from "./control-plane-prisma.service";

@Global()
@Module({
  providers: [
    ControlPlaneClient,
    ControlPlaneEntitlementGuard,
    ControlPlanePrismaService,
  ],
  exports: [
    ControlPlaneClient,
    ControlPlaneEntitlementGuard,
    ControlPlanePrismaService,
  ],
})
export class ControlPlaneModule {}
