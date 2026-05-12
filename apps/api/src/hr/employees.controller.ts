import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { isDepartmentHeadRole } from "../auth/policies/hr-payroll.policy";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { CheckQuota } from "../common/decorators/check-quota.decorator";
import { QuotaGuard } from "../common/guards/quota.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { QuotaResource } from "../quota/quota-resource";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { BulkPrefillEmployeesDto } from "./dto/bulk-prefill-employees.dto";
import { BulkSyncResultEmployeesDto } from "./dto/bulk-sync-result-employees.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { DepartmentHeadScopeService } from "./department-head-scope.service";
import { EmployeesService } from "./employees.service";

@ApiTags("hr-employees")
@ApiBearerAuth("bearer")
@Controller("hr/employees")
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly scope: DepartmentHeadScopeService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.DEPARTMENT_HEAD,
  )
  @ApiOperation({
    summary:
      "Список сотрудников (пагинация; departmentId — фильтр; DEPARTMENT_HEAD — только свой отдел)",
  })
  async list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    const role = requireOrgRole(user);
    let dept = departmentId;
    if (isDepartmentHeadRole(role)) {
      dept =
        (await this.scope.resolveManagedDepartmentId(
          organizationId,
          user.userId,
        )) ?? undefined;
    }
    const p =
      page != null && page !== "" ? Number.parseInt(page, 10) : undefined;
    const ps =
      pageSize != null && pageSize !== ""
        ? Number.parseInt(pageSize, 10)
        : undefined;
    return this.employees.list(organizationId, {
      page: p,
      pageSize: ps,
      departmentId: dept,
    });
  }

  @Get(":id/prefill")
  @ApiOperation({
    summary:
      "Сотрудник — минимальный DTO для браузерного расширения (ƏMAS prefill)",
  })
  getPrefillForExtension(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.employees.getExtensionPrefill(organizationId, id);
  }

  @Post("bulk-prefill")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Bulk DTO list for extension ƏMAS prefill" })
  getBulkPrefill(
    @OrganizationId() organizationId: string,
    @Body() dto: BulkPrefillEmployeesDto,
  ) {
    return this.employees.getExtensionPrefillBulk(organizationId, dto.employeeIds);
  }

  @Post("bulk-sync-result")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Persist bulk sync results for employees (ƏMAS)" })
  saveBulkSyncResult(
    @OrganizationId() organizationId: string,
    @Body() dto: BulkSyncResultEmployeesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employees.saveBulkSyncResult(organizationId, dto, user.userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Сотрудник по id" })
  getOne(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.employees.getOne(organizationId, id);
  }

  @Post()
  @UseGuards(QuotaGuard, RolesGuard)
  @CheckQuota(QuotaResource.USERS)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Создать сотрудника" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employees.create(organizationId, dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Обновить сотрудника" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(organizationId, id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Удалить сотрудника" })
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.employees.remove(organizationId, id);
  }
}
