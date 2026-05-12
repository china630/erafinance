import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SecurityMode } from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";

export const ALLOW_IN_DISPUTE_MODE = "allowInDisputeMode";

/** Routes marked with @AllowInDisputeMode skip freeze checks. */
export const AllowInDisputeMode = () => SetMetadata(ALLOW_IN_DISPUTE_MODE, true);

function isFrozenWrite(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PATCH" || m === "PUT" || m === "DELETE";
}

@Injectable()
export class DisputeFreezeGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allow = this.reflector.getAllAndOverride<boolean>(ALLOW_IN_DISPUTE_MODE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allow) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      user?: { organizationId?: string | null; isSuperAdmin?: boolean };
      method?: string;
      originalUrl?: string;
      url?: string;
    }>();
    const url = (req.originalUrl ?? req.url ?? "").split("?")[0];
    if (url.includes("/api/admin") || url.includes("/api/public") || url.includes("/api/auth")) {
      return true;
    }
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return true;
    }
    const state = await this.prisma.organizationSecurityState.findUnique({
      where: { organizationId: orgId },
    });
    const mode = state?.mode ?? SecurityMode.NORMAL;

    if (mode === SecurityMode.HARD_BLOCK_PLATFORM) {
      const m = (req.method ?? "GET").toUpperCase();
      if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
        throw new ForbiddenException("Organization blocked by platform security (HARD_BLOCK_PLATFORM)");
      }
      return true;
    }

    if (mode !== SecurityMode.DISPUTE && mode !== SecurityMode.ROLLBACK_IN_PROGRESS) {
      return true;
    }
    const m = (req.method ?? "GET").toUpperCase();
    if (m === "DELETE") {
      throw new ForbiddenException("Mutations frozen during dispute / rollback");
    }
    if (isFrozenWrite(m)) {
      const path = url.replace(/^.*\/api/, "/api");
      if (/\/archive\b/i.test(path)) {
        throw new ForbiddenException("Archive frozen during dispute / rollback");
      }
      if (path.includes("/subscription")) {
        throw new ForbiddenException("Subscription changes frozen during dispute / rollback");
      }
      if (path.includes("/organizations") && path.includes("transfer-ownership")) {
        throw new ForbiddenException("Ownership transfer frozen during dispute / rollback");
      }
      if (path.includes("/migration")) {
        throw new ForbiddenException("Migration frozen during dispute / rollback");
      }
      if (path.includes("/hard-delete")) {
        throw new ForbiddenException("Hard-delete frozen during dispute / rollback");
      }
    }
    return true;
  }
}
