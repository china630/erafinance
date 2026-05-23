import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BillingStatus } from "@erafinance/database";
import { IS_PUBLIC_KEY } from "../auth/constants";
import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../prisma/prisma.service";
import { ControlPlaneClient } from "./control-plane.client";

/**
 * Validates tenant billing / entitlements via era-365-orchestrator.
 * Falls back to legacy organizations.billing_status when control plane is down.
 */
@Injectable()
export class ControlPlaneEntitlementGuard implements CanActivate {
  constructor(
    private readonly controlPlane: ControlPlaneClient,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      method: string;
      path?: string;
      url?: string;
      user?: AuthUser;
      originalUrl?: string;
    }>();
    const method = (req.method ?? "GET").toUpperCase();
    const path =
      req.originalUrl?.split("?")[0] ??
      req.path ??
      req.url?.split("?")[0] ??
      "";
    const user = req.user;
    if (!user?.organizationId || user.isSuperAdmin) return true;

    const remote = await this.controlPlane.validateEntitlement({
      organizationId: user.organizationId,
      userId: user.userId,
      method,
      path,
      isSuperAdmin: user.isSuperAdmin,
    });
    if (remote) {
      if (remote.allowed) return true;
      throw new HttpException(
        {
          statusCode: remote.httpStatus ?? HttpStatus.PAYMENT_REQUIRED,
          code: remote.code,
          message: remote.message,
        },
        remote.httpStatus ?? HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return this.legacyLocalBillingCheck(user.organizationId, method, path);
  }

  /** @deprecated Remove after tenant_billing backfill and control-plane SLA. */
  private async legacyLocalBillingCheck(
    organizationId: string,
    method: string,
    path: string,
  ): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingStatus: true },
    });
    const status = org?.billingStatus ?? BillingStatus.ACTIVE;
    const normalized = this.normalizePath(path);

    if (status === BillingStatus.SOFT_BLOCK) {
      if (this.isExportPath(normalized)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            code: "BILLING_SOFT_BLOCK_EXPORTS",
            message:
              "Billing SOFT_BLOCK: export functions are restricted until invoice payment.",
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      return true;
    }

    if (status === BillingStatus.HARD_BLOCK) {
      if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
      if (this.isEarlyAccessPath(normalized)) return true;
      if (this.isBillingPaymentPath(normalized, method)) return true;
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          code: "BILLING_HARD_BLOCK_READ_ONLY",
          message:
            "Billing HARD_BLOCK: system is in read-only mode until invoice payment.",
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }

  private normalizePath(path: string): string {
    if (!path) return "";
    if (path.startsWith("/api")) return path;
    return path.startsWith("/") ? `/api${path}` : `/api/${path}`;
  }

  private isEarlyAccessPath(path: string): boolean {
    return path.startsWith("/api/early-access/");
  }

  private isBillingPaymentPath(path: string, method: string): boolean {
    if (method !== "POST") return false;
    if (path === "/api/billing/checkout") return true;
    if (path.startsWith("/api/billing/webhooks/")) return true;
    if (path === "/api/public/billing/webhook") return true;
    if (path.startsWith("/api/integrations/drakaris/")) return true;
    return false;
  }

  private isExportPath(path: string): boolean {
    const p = path.toLowerCase();
    return (
      p.includes("/export") ||
      p.includes("/pdf") ||
      p.includes("/xlsx") ||
      p.includes("/xml") ||
      p.includes("/tax-export")
    );
  }
}
