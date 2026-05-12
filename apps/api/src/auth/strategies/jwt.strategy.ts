import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { UserRole } from "@erafinance/database";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "../auth.service";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  organizationId: string | null;
  role: UserRole | null;
  /** Browser extension access tokens (POST /auth/extension/refresh). */
  aud?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  validate(payload: AccessTokenPayload) {
    return this.auth.validateUserForJwtPayload(payload);
  }
}
