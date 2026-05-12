import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { UserRole } from "@erafinance/database";
import { RolesGuard } from "../../src/auth/guards/roles.guard";
import { ROLES_KEY } from "../../src/auth/decorators/roles.decorator";

function mockExecutionContext(
  method: string,
  path: string,
  req: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        path,
        originalUrl: path,
        ...req,
      }),
    }),
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe("RolesGuard + audit engagement guest", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();
    guard = moduleRef.get(RolesGuard);
    reflector = moduleRef.get(Reflector);
    jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key: unknown) => {
      if (key === ROLES_KEY) {
        return [UserRole.ADMIN];
      }
      return undefined;
    });
  });

  it("allows GET /api/audit-hub/summary for non-admin when engagement headers resolved", () => {
    const ctx = mockExecutionContext("GET", "/api/audit-hub/summary", {
      user: { role: UserRole.HR_MANAGER, userId: "u1", email: "a@b.c" },
      auditEngagementEffectiveOrgId: "00000000-0000-0000-0000-000000000099",
      auditEngagementInvitePermissions: { auditHubRead: true },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows GET /api/activity/invoice/00000000-0000-0000-0000-000000000001 for guest read", () => {
    const ctx = mockExecutionContext(
      "GET",
      "/api/activity/invoice/00000000-0000-0000-0000-000000000001",
      {
        user: { role: UserRole.HR_MANAGER, userId: "u1", email: "a@b.c" },
        auditEngagementEffectiveOrgId: "00000000-0000-0000-0000-000000000099",
        auditEngagementInvitePermissions: { auditHubRead: true },
      },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("denies GET /api/audit-hub/summary when engagement read disabled", () => {
    const ctx = mockExecutionContext("GET", "/api/audit-hub/summary", {
      user: { role: UserRole.HR_MANAGER, userId: "u1", email: "a@b.c" },
      auditEngagementEffectiveOrgId: "00000000-0000-0000-0000-000000000099",
      auditEngagementInvitePermissions: { auditHubRead: false },
    });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("denies non-GET audit-hub for guest without role match", () => {
    const ctx = mockExecutionContext("POST", "/api/audit-hub/sampling", {
      user: { role: UserRole.HR_MANAGER, userId: "u1", email: "a@b.c" },
      auditEngagementEffectiveOrgId: "00000000-0000-0000-0000-000000000099",
      auditEngagementInvitePermissions: { auditHubRead: true },
    });
    expect(guard.canActivate(ctx)).toBe(false);
  });
});
