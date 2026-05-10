import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { timingSafeEqual } from "crypto";
import { Public } from "../../../auth/decorators/public.decorator";
import { DrakarisService } from "./drakaris.service";
import type { DrakarisEnvelope } from "./drakaris-status";

function safeEqualUtf8(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

@ApiTags("drakaris-yigim")
@Public()
@Throttle({ default: { limit: 6000, ttl: 60_000 } })
@Controller("integrations/drakaris/v1")
export class DrakarisController {
  constructor(
    private readonly drakaris: DrakarisService,
    private readonly config: ConfigService,
  ) {}

  private basicAuthOk(authHeader: string | undefined): boolean {
    const expectedUser =
      this.config.get<string>("DRAKARIS_BASIC_USER", "")?.trim() ?? "";
    const expectedPass =
      this.config.get<string>("DRAKARIS_BASIC_PASS", "")?.trim() ?? "";
    if (!expectedUser || !expectedPass) return false;
    if (!authHeader?.startsWith("Basic ")) return false;
    let decoded: string;
    try {
      decoded = Buffer.from(authHeader.slice(6).trim(), "base64").toString(
        "utf8",
      );
    } catch {
      return false;
    }
    const sep = decoded.indexOf(":");
    const user = sep >= 0 ? decoded.slice(0, sep) : decoded;
    const pass = sep >= 0 ? decoded.slice(sep + 1) : "";
    return safeEqualUtf8(user, expectedUser) && safeEqualUtf8(pass, expectedPass);
  }

  private unauthorized(): DrakarisEnvelope {
    return {
      status: 401,
      description: "Unauthorized",
      data: null,
    };
  }

  @Get("client/:id")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Drakaris/yığım: client lookup (masked name, balance). Basic Auth required.",
  })
  async checkClient(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ): Promise<DrakarisEnvelope> {
    if (!this.basicAuthOk(authorization)) {
      return this.unauthorized();
    }
    return this.drakaris.checkClient(id);
  }

  @Post("client/:id/payments")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Drakaris/yığım: deposit / subscription top-up. Maps transaction-id to PaymentOrder idempotency.",
  })
  async topUp(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<DrakarisEnvelope> {
    if (!this.basicAuthOk(authorization)) {
      return this.unauthorized();
    }
    return this.drakaris.topUpBalance(id, body ?? {});
  }
}
