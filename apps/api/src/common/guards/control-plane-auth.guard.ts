import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { verify } from "jsonwebtoken";
import { IS_PUBLIC_KEY } from "../../auth/constants";
import type { AuthUser } from "../../auth/types/auth-user";
import type { ControlPlaneJwtPayload } from "../types/control-plane-jwt-payload";

/**
 * Stateless JWT authentication for finance API (control-plane IdP).
 * - Extracts `Authorization: Bearer <token>`
 * - Verifies HS256 with `ERA_JWT_SECRET` (later JWKS via `ERA_JWT_JWKS_URI`)
 * - Validates `iss`, `aud`, `exp` — never hits Prisma / `validateUserForJwtPayload`
 * - Sets `request.user` compatible with {@link AuthUser}
 */
@Injectable()
export class ControlPlaneAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const token = header.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const secret =
      this.config.get<string>("ERA_JWT_SECRET") ??
      this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new UnauthorizedException("JWT verifier not configured");
    }

    const issuer =
      this.config.get<string>("ERA_JWT_ISSUER") ?? "era-365-orchestrator";
    const audience =
      this.config.get<string>("ERA_JWT_AUDIENCE_FINANCE") ?? "era-finance-core";

    let payload: ControlPlaneJwtPayload;
    try {
      payload = verify(token, secret, {
        issuer,
        audience,
        algorithms: ["HS256"],
      }) as ControlPlaneJwtPayload;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    req.user = {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId ?? null,
      role: payload.role ?? null,
      isSuperAdmin: Boolean(payload.isSuperAdmin),
    };
    return true;
  }
}
