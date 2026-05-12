import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
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
import type { Request } from "express";
import { OrganizationId } from "../common/org-id.decorator";
import type { RequestWithAuditEngagement } from "../common/request-with-audit-engagement";
import { ActivityStreamService } from "./activity-stream.service";
import { CreateEntityCommentDto } from "./dto/create-entity-comment.dto";
import { UpdateEntityCommentDto } from "./dto/update-entity-comment.dto";

@ApiTags("activity-stream")
@ApiBearerAuth("bearer")
@Controller("activity")
export class ActivityStreamController {
  constructor(private readonly activity: ActivityStreamService) {}

  @Get(":entityType/:entityId")
  @ApiOperation({ summary: "Merged activity timeline (system events + comments)" })
  timeline(
    @OrganizationId() orgId: string,
    @Param("entityType") entityType: string,
    @Param("entityId", new ParseUUIDPipe()) entityId: string,
  ) {
    return this.activity.getTimeline(orgId, entityType, entityId);
  }

  @Post(":entityType/:entityId/comments")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.USER,
    UserRole.PROCUREMENT,
    UserRole.WAREHOUSE_KEEPER,
    UserRole.HR_OFFICER,
    UserRole.HR_MANAGER,
    UserRole.DEPARTMENT_HEAD,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: "Post a comment; @email mentions notify users in the org" })
  postComment(
    @OrganizationId() orgId: string,
    @Param("entityType") entityType: string,
    @Param("entityId", new ParseUUIDPipe()) entityId: string,
    @Body() dto: CreateEntityCommentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & RequestWithAuditEngagement,
  ) {
    const guestAuditNote =
      Boolean(req.auditEngagementEffectiveOrgId) &&
      req.auditEngagementInvitePermissions?.auditNotesWrite !== false;
    return this.activity.createComment(
      orgId,
      user.userId,
      entityType,
      entityId,
      dto,
      user.role ?? UserRole.USER,
      guestAuditNote,
    );
  }

  @Patch("comments/:id")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.USER,
    UserRole.PROCUREMENT,
    UserRole.WAREHOUSE_KEEPER,
    UserRole.HR_OFFICER,
    UserRole.HR_MANAGER,
    UserRole.DEPARTMENT_HEAD,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: "Edit own comment" })
  patchComment(
    @OrganizationId() orgId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEntityCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.activity.updateComment(
      orgId,
      id,
      user.userId,
      dto,
      user.role ?? UserRole.USER,
    );
  }

  @Delete("comments/:id")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.USER,
    UserRole.PROCUREMENT,
    UserRole.WAREHOUSE_KEEPER,
    UserRole.HR_OFFICER,
    UserRole.HR_MANAGER,
    UserRole.DEPARTMENT_HEAD,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: "Soft-delete own comment" })
  deleteComment(
    @OrganizationId() orgId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Query("reason") reason?: string,
  ) {
    return this.activity.softDeleteComment(
      orgId,
      id,
      user.userId,
      reason ?? null,
      user.role ?? UserRole.USER,
    );
  }
}
