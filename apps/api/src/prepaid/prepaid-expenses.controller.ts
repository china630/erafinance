import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { CreatePrepaidExpenseDto } from "./dto/create-prepaid-expense.dto";
import { PrepaidExpensesService } from "./prepaid-expenses.service";

@ApiTags("prepaid-expenses")
@ApiBearerAuth("bearer")
@Controller("prepaid-expenses")
@UseGuards(RolesGuard)
export class PrepaidExpensesController {
  constructor(private readonly prepaid: PrepaidExpensesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "List prepaid expenses for the organization" })
  list(@OrganizationId() orgId: string) {
    return this.prepaid.list(orgId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create prepaid expense and generate monthly schedule" })
  create(@OrganizationId() orgId: string, @Body() dto: CreatePrepaidExpenseDto) {
    return this.prepaid.create(orgId, dto);
  }

  @Post(":id/post-month")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: "Post amortization for a schedule period (Dr expense / Cr prepaid)",
  })
  postMonth(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Query("period") period: string,
  ) {
    if (!period?.trim()) {
      throw new BadRequestException("period query (YYYY-MM) is required");
    }
    return this.prepaid.postMonth({
      organizationId: orgId,
      prepaidExpenseId: id,
      period: period ?? "",
    });
  }
}
