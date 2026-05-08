import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsString, MaxLength, MinLength } from "class-validator";
import { Public } from "../../auth/decorators/public.decorator";
import { DisputeService } from "./dispute.service";

class CounterClaimDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  note!: string;
}

@ApiTags("public-dispute")
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller("public/disputes")
export class DisputePublicController {
  constructor(private readonly disputes: DisputeService) {}

  @Public()
  @Get(":id/meta")
  @ApiOperation({ summary: "Limited dispute meta for incumbent (requires token query)" })
  meta(@Param("id") id: string, @Query("t") token: string) {
    return this.disputes.getPublicDisputeMeta(id, token);
  }

  @Public()
  @Post(":id/counter-claim")
  @ApiOperation({ summary: "Submit counter-claim note (incumbent, token from email)" })
  counterClaim(@Param("id") id: string, @Body() dto: CounterClaimDto) {
    return this.disputes.recordCounterClaim(id, dto.token, dto.note);
  }
}
