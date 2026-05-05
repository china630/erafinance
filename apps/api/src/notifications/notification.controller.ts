import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { NotificationService } from "./notification.service";

@ApiTags("notifications")
@ApiBearerAuth("bearer")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: "List notifications for current user (paged)" })
  list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.list(organizationId, user.userId, query);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Unread notification count (badge)" })
  unreadCount(
    @OrganizationId() _organizationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications
      .unreadCount(user.userId)
      .then((count) => ({ count }));
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark all notifications as read" })
  markAllRead(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.markAllRead(organizationId, user.userId);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark one notification as read" })
  markRead(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.notifications.markRead(organizationId, user.userId, id);
  }
}
