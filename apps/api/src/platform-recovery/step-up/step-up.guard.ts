import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthUser } from "../../auth/types/auth-user";
import { REQUIRES_STEP_UP_KEY } from "./step-up.constants";
import { StepUpAuthService } from "./step-up-auth.service";

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stepUp: StepUpAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const purpose = this.reflector.getAllAndOverride<string>(REQUIRES_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!purpose) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Not authenticated");
    }
    const raw = req.headers["x-step-up-token"] ?? req.headers["X-StepUp-Token"];
    const token = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
    await this.stepUp.assertStepUpToken(token, purpose, userId);
    return true;
  }
}
