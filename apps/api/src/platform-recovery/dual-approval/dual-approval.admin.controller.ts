import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../auth/guards/super-admin.guard";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreateDualApprovalDto } from "./dto/create-dual-approval.dto";
import { DualApprovalService } from "./dual-approval.service";

@ApiTags("admin-platform-recovery")
@ApiBearerAuth("bearer")
@Controller("admin/platform/dual-approval")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class DualApprovalAdminController {
  constructor(private readonly dual: DualApprovalService) {}

  @Post()
  @ApiOperation({ summary: "Create dual-approval request (super-admin)" })
  create(@Req() req: Request & { user: AuthUser }, @Body() dto: CreateDualApprovalDto) {
    return this.dual.createRequestWithExpiry(req.user.userId, dto.purpose, dto.payload);
  }

  @Post(":id/approve")
  @ApiOperation({ summary: "Approve dual-approval request (second approver locks APPROVED)" })
  approve(@Req() req: Request & { user: AuthUser }, @Param("id") id: string) {
    return this.dual.approve(id, req.user.userId);
  }
}
