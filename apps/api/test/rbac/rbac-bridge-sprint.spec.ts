import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { UserRole } from "@erafinance/database";
import { RolesGuard } from "../../src/auth/guards/roles.guard";
import { AuditorMutationGuard } from "../../src/auth/guards/auditor-mutation.guard";
import { InventoryAuditController } from "../../src/inventory/inventory-audit.controller";
import { InventoryReconciliationController } from "../../src/inventory/inventory-reconciliation.controller";

function mockHttpContext(params: {
  method: string;
  path: string;
  role?: UserRole;
  handler: (...args: unknown[]) => unknown;
  controllerClass: new (...args: unknown[]) => unknown;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: params.method,
        path: params.path,
        originalUrl: params.path,
        user:
          params.role == null
            ? undefined
            : { role: params.role, userId: "u-1", organizationId: "o-1" },
      }),
    }),
    getHandler: () => params.handler,
    getClass: () => params.controllerClass,
  } as unknown as ExecutionContext;
}

describe("RBAC Bridge Sprint P1", () => {
  it("PROCUREMENT получает запрет на /inventory/reconciliations/:id/complete (RolesGuard -> false/403)", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();
    const guard = moduleRef.get(RolesGuard);

    const ctx = mockHttpContext({
      method: "POST",
      path: "/api/inventory/reconciliations/a1/complete",
      role: UserRole.PROCUREMENT,
      handler: InventoryReconciliationController.prototype.complete,
      controllerClass: InventoryReconciliationController,
    });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("AUDITOR получает 403 на PATCH /hr/absences", () => {
    const guard = new AuditorMutationGuard();
    const ctx = mockHttpContext({
      method: "PATCH",
      path: "/api/hr/absences/a1",
      role: UserRole.AUDITOR,
      handler: () => undefined,
      controllerClass: InventoryAuditController,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
