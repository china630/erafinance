import { BadRequestException, Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../auth/guards/super-admin.guard";
import type { AuthUser } from "../../auth/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestStepUpOtpDto } from "./dto/request-step-up-otp.dto";
import { VerifyStepUpOtpDto } from "./dto/verify-step-up-otp.dto";
import { StepUpAuthService } from "./step-up-auth.service";

@ApiTags("admin-platform-recovery")
@ApiBearerAuth("bearer")
@Controller("admin/platform/step-up")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class StepUpAdminController {
  constructor(
    private readonly stepUp: StepUpAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("otp/request")
  @ApiOperation({ summary: "Send email OTP for step-up (super-admin)" })
  async requestOtp(@Req() req: Request & { user: AuthUser }, @Body() dto: RequestStepUpOtpDto) {
    const userId = req.user.userId;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) {
      throw new BadRequestException("User email not found for step-up");
    }
    await this.stepUp.requestEmailOtp(userId, user.email, dto.purpose);
    return { ok: true };
  }

  @Post("otp/verify")
  @ApiOperation({ summary: "Verify OTP and return short-lived X-StepUp-Token JWT" })
  verifyOtp(@Req() req: Request & { user: AuthUser }, @Body() dto: VerifyStepUpOtpDto) {
    return this.stepUp.verifyEmailOtpAndIssueToken(req.user.userId, dto.purpose, dto.code);
  }
}
