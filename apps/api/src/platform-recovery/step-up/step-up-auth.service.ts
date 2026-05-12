import { createHmac, randomInt } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis";
import { MailService } from "../../mail/mail.service";

const TTL_SEC = 300;
const MAX_ATTEMPTS = 3;
const LOCKOUT_SEC = 1800;

@Injectable()
export class StepUpAuthService {
  private readonly redis: Redis;
  private readonly secret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {
    this.redis = new Redis(this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"), {
      maxRetriesPerRequest: 1,
    });
    this.secret =
      this.config.get<string>("STEP_UP_HMAC_SECRET") ??
      this.config.get<string>("JWT_SECRET") ??
      "step-up-dev-only";
  }

  private otpKey(userId: string, purpose: string) {
    return `stepup:otp:${userId}:${purpose}`;
  }

  private lockKey(userId: string, purpose: string) {
    return `stepup:lock:${userId}:${purpose}`;
  }

  private hashCode(code: string): string {
    return createHmac("sha256", this.secret).update(code).digest("hex");
  }

  async requestEmailOtp(userId: string, email: string, purpose: string): Promise<void> {
    const lock = await this.redis.get(this.lockKey(userId, purpose));
    if (lock) {
      throw new UnauthorizedException("Step-up temporarily locked; try again later.");
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const key = this.otpKey(userId, purpose);
    await this.redis.set(key, JSON.stringify({ h: this.hashCode(code), n: 0 }), "EX", TTL_SEC);
    await this.mail.sendMail({
      to: email,
      subject: "ERA Finance — step-up code",
      text: `Your code: ${code}\nPurpose: ${purpose}\nValid for ${Math.floor(TTL_SEC / 60)} minutes.`,
    });
  }

  async verifyEmailOtpAndIssueToken(
    userId: string,
    purpose: string,
    code: string,
  ): Promise<{ stepUpToken: string; expiresInSec: number }> {
    const key = this.otpKey(userId, purpose);
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new UnauthorizedException("Invalid or expired step-up code");
    }
    const rec = JSON.parse(raw) as { h: string; n: number };
    if (rec.h !== this.hashCode(code)) {
      const n = rec.n + 1;
      if (n >= MAX_ATTEMPTS) {
        await this.redis.del(key);
        await this.redis.set(this.lockKey(userId, purpose), "1", "EX", LOCKOUT_SEC);
        throw new UnauthorizedException("Too many attempts; step-up locked");
      }
      await this.redis.set(key, JSON.stringify({ h: rec.h, n }), "KEEPTTL");
      throw new UnauthorizedException("Invalid step-up code");
    }
    await this.redis.del(key);
    const expiresInSec = 600;
    const stepUpToken = await this.jwt.signAsync(
      { sub: userId, typ: "step_up", purpose },
      { secret: this.config.getOrThrow<string>("JWT_SECRET"), expiresIn: expiresInSec },
    );
    return { stepUpToken, expiresInSec };
  }

  async assertStepUpToken(
    token: string | undefined,
    expectedPurpose: string,
    expectedUserId: string,
  ): Promise<void> {
    if (!token) {
      throw new UnauthorizedException("X-StepUp-Token required");
    }
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; typ?: string; purpose?: string }>(token, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });
      if (p.typ !== "step_up" || p.purpose !== expectedPurpose) {
        throw new UnauthorizedException("Invalid step-up token");
      }
      if (p.sub !== expectedUserId) {
        throw new UnauthorizedException("Step-up token does not match current user");
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException("Invalid step-up token");
    }
  }
}
