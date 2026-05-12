import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { ApprovalsService } from "./approvals.service";
import { RejectApprovalStepDto } from "./dto/reject-approval-step.dto";

@ApiTags("approvals")
@ApiBearerAuth("bearer")
@Controller("approvals")
@UseGuards(RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get("inbox")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.USER,
    UserRole.PROCUREMENT,
    UserRole.WAREHOUSE_KEEPER,
    UserRole.HR_OFFICER,
    UserRole.HR_MANAGER,
    UserRole.DEPARTMENT_HEAD,
  )
  @ApiOperation({ summary: "Pending approval requests where the current step matches your org role" })
  inbox(@OrganizationId() orgId: string, @CurrentUser() user: AuthUser) {
    return this.approvals.inboxForUser(orgId, user.userId);
  }

  @Post("cash-orders/:id/submit")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Submit draft cash order for approval when a matching policy exists" })
  submitCashOrder(
    @OrganizationId() orgId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvals.submitCashOrder({
      organizationId: orgId,
      userId: user.userId,
      cashOrderId: id,
    });
  }

  @Post("requests/:requestId/steps/:stepNo/approve")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.USER,
    UserRole.PROCUREMENT,
    UserRole.WAREHOUSE_KEEPER,
    UserRole.HR_OFFICER,
    UserRole.HR_MANAGER,
    UserRole.DEPARTMENT_HEAD,
  )
  @ApiOperation({ summary: "Approve current step (must match assigned role)" })
  approve(
    @OrganizationId() orgId: string,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Param("stepNo", ParseIntPipe) stepNo: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvals.approveStep({
      organizationId: orgId,
      userId: user.userId,
      requestId,
      stepNo,
    });
  }

  @Post("requests/:requestId/steps/:stepNo/reject")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.USER,
    UserRole.PROCUREMENT,
    UserRole.WAREHOUSE_KEEPER,
    UserRole.HR_OFFICER,
    UserRole.HR_MANAGER,
    UserRole.DEPARTMENT_HEAD,
  )
  @ApiOperation({ summary: "Reject current step (comment required)" })
  reject(
    @OrganizationId() orgId: string,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Param("stepNo", ParseIntPipe) stepNo: number,
    @Body() dto: RejectApprovalStepDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvals.rejectStep({
      organizationId: orgId,
      userId: user.userId,
      requestId,
      stepNo,
      comment: dto.comment,
    });
  }
}
