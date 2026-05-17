import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { ClassifyReconciliationLineDto } from "./dto/classify-reconciliation-line.dto";
import { CancelReconciliationDto } from "./dto/cancel-reconciliation.dto";
import { CreateReconciliationDraftDto } from "./dto/create-reconciliation-draft.dto";
import { SetReconciliationLineFactDto } from "./dto/set-reconciliation-line-fact.dto";
import { InventoryAuditService } from "./inventory-audit.service";

@ApiTags("inventory-reconciliations")
@ApiBearerAuth("bearer")
@Controller("inventory/reconciliations")
export class InventoryReconciliationController {
  constructor(private readonly audits: InventoryAuditService) {}

  @Get()
  @ApiOperation({ summary: "List inventory reconciliations (сличительные ведомости)" })
  list(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.audits.findAll(organizationId, { page, pageSize });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get reconciliation by id" })
  getOne(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.audits.findOne(organizationId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create DRAFT reconciliation (no stock snapshot yet)" })
  createDraft(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateReconciliationDraftDto,
    @CurrentUser() user: AuthUser,
  ) {
    requireOrgRole(user);
    return this.audits.createReconciliationDraft(organizationId, dto);
  }

  @Post(":id/start")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Start COUNTING: snapshot lines + lock warehouse" })
  startCounting(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.startCounting(organizationId, id, requireOrgRole(user));
  }

  @Patch(":id/lines/:lineId")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Update fact qty / cost in COUNTING" })
  setLineFact(
    @OrganizationId() organizationId: string,
    @Param("lineId") lineId: string,
    @Body() dto: SetReconciliationLineFactDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.setLineFact(organizationId, lineId, dto, requireOrgRole(user));
  }

  @Post(":id/submit")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "COUNTING → REVIEW" })
  submitForReview(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.submitForReview(organizationId, id, requireOrgRole(user));
  }

  @Patch(":id/lines/:lineId/classification")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Classify discrepancy in REVIEW" })
  classifyLine(
    @OrganizationId() organizationId: string,
    @Param("lineId") lineId: string,
    @Body() dto: ClassifyReconciliationLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.classifyLine(organizationId, lineId, dto, requireOrgRole(user));
  }

  @Post(":id/complete")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "REVIEW → COMPLETED: stock + GL in one transaction" })
  complete(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.complete(
      organizationId,
      id,
      user.userId,
      requireOrgRole(user),
    );
  }

  @Post(":id/cancel")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Cancel DRAFT / COUNTING / REVIEW" })
  cancel(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: CancelReconciliationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audits.cancel(organizationId, id, requireOrgRole(user), dto);
  }
}
