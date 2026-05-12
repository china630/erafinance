import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import type { Request } from "express";
import { DisputeStatus, DisputeSeverity } from "@erafinance/database";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../auth/guards/super-admin.guard";
import type { AuthUser } from "../../auth/types/auth-user";
import { DualApprovalGuard } from "../dual-approval/dual-approval.guard";
import { RequiresDualApproval } from "../dual-approval/requires-dual-approval.decorator";
import { DUAL_APPROVAL_PURPOSE_OWNERSHIP_TRANSFER } from "../dual-approval/dual-approval.constants";
import { StepUpGuard } from "../step-up/step-up.guard";
import { RequiresStepUp } from "../step-up/requires-step-up.decorator";
import { STEP_UP_PURPOSE_OWNERSHIP_TRANSFER } from "../step-up/step-up.constants";
import { DisputeService } from "./dispute.service";

class OpenDisputeDto {
  @IsUUID()
  claimantUserId!: string;

  @IsUUID()
  incumbentUserId!: string;

  @IsOptional()
  evidenceKeys?: string[];

  @IsEnum(DisputeSeverity)
  @IsOptional()
  severity?: DisputeSeverity;
}

class PatchDisputeStatusDto {
  @IsEnum(DisputeStatus)
  status!: DisputeStatus;
}

class ExecuteTransferDto {
  @IsUUID()
  dualApprovalRequestId!: string;
}

@ApiTags("admin-platform-recovery")
@ApiBearerAuth("bearer")
@Controller("admin/organizations")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class DisputeAdminController {
  constructor(private readonly disputes: DisputeService) {}

  @Post(":organizationId/disputes")
  @ApiOperation({ summary: "Open ownership dispute (platform)" })
  open(
    @Param("organizationId") organizationId: string,
    @Body() dto: OpenDisputeDto,
  ) {
    return this.disputes.openDispute({
      organizationId,
      claimantUserId: dto.claimantUserId,
      incumbentUserId: dto.incumbentUserId,
      evidenceKeys: dto.evidenceKeys ?? [],
      severity: dto.severity ?? DisputeSeverity.SOFT,
    });
  }

  @Get(":organizationId/disputes")
  list(@Param("organizationId") organizationId: string) {
    return this.disputes.listForOrganization(organizationId);
  }

  @Get(":organizationId/security-state")
  security(@Param("organizationId") organizationId: string) {
    return this.disputes.getSecurityState(organizationId);
  }

  @Patch(":organizationId/disputes/:disputeId/status")
  @ApiOperation({ summary: "Update dispute status (super-admin workflow)" })
  patchStatus(
    @Param("organizationId") organizationId: string,
    @Param("disputeId") disputeId: string,
    @Body() dto: PatchDisputeStatusDto,
  ) {
    return this.disputes.patchDisputeStatusScoped(organizationId, disputeId, dto.status);
  }

  @Post(":organizationId/disputes/:disputeId/notify")
  @ApiOperation({ summary: "Re-send incumbent notifications (email / in-app / SMS stub)" })
  notify(@Param("disputeId") disputeId: string) {
    return this.disputes.notifyIncumbent(disputeId);
  }

  @Post(":organizationId/disputes/:disputeId/request-execution")
  @ApiOperation({ summary: "Create dual-approval request for approved dispute" })
  requestExecution(
    @Req() req: Request & { user: AuthUser },
    @Param("disputeId") disputeId: string,
  ) {
    return this.disputes.requestExecution(disputeId, req.user.userId);
  }

  @Post(":organizationId/disputes/:disputeId/execute")
  @UseGuards(StepUpGuard, DualApprovalGuard)
  @RequiresStepUp(STEP_UP_PURPOSE_OWNERSHIP_TRANSFER)
  @RequiresDualApproval(DUAL_APPROVAL_PURPOSE_OWNERSHIP_TRANSFER)
  @ApiOperation({ summary: "Execute ownership transfer (step-up + dual approval + snapshot)" })
  execute(
    @Req() req: Request & { user: AuthUser },
    @Param("disputeId") disputeId: string,
    @Body() dto: ExecuteTransferDto,
  ) {
    return this.disputes.executeTransfer({
      disputeId,
      dualApprovalRequestId: dto.dualApprovalRequestId,
      executorUserId: req.user.userId,
    });
  }
}
