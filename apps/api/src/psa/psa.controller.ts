import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CheckQuota } from "../common/decorators/check-quota.decorator";
import { QuotaGuard } from "../common/guards/quota.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { QuotaResource } from "../quota/quota-resource";
import { CreatePsaProjectDto } from "./dto/create-psa-project.dto";
import { CreatePsaTaskDto } from "./dto/create-psa-task.dto";
import { CreatePsaTimeEntryDto } from "./dto/create-psa-time-entry.dto";
import { GeneratePsaInvoiceDto } from "./dto/generate-psa-invoice.dto";
import { PatchPsaTimeEntryDto } from "./dto/patch-psa-time-entry.dto";
import { UpdatePsaProjectDto } from "./dto/update-psa-project.dto";
import { PsaService } from "./psa.service";

@ApiTags("psa")
@ApiBearerAuth("bearer")
@Controller("psa")
@UseGuards(RolesGuard)
export class PsaController {
  constructor(private readonly psa: PsaService) {}

  @Get("projects")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: "List PSA projects" })
  listProjects(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.psa.listProjects(organizationId, { page, pageSize });
  }

  @Post("projects")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create PSA project" })
  createProject(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePsaProjectDto,
  ) {
    return this.psa.createProject(organizationId, dto);
  }

  @Get("projects/:id")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: "Get PSA project" })
  getProject(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.psa.getProject(organizationId, id);
  }

  @Patch("projects/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Update PSA project" })
  updateProject(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePsaProjectDto,
  ) {
    return this.psa.updateProject(organizationId, id, dto);
  }

  @Get("projects/:id/tasks")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: "List project tasks" })
  listTasks(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) projectId: string,
  ) {
    return this.psa.listTasks(organizationId, projectId);
  }

  @Post("projects/:id/tasks")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create project task" })
  createTask(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Body() dto: CreatePsaTaskDto,
  ) {
    return this.psa.createTask(organizationId, projectId, dto);
  }

  @Get("projects/:id/time-entries")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: "List time entries" })
  listTimeEntries(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) projectId: string,
  ) {
    return this.psa.listTimeEntries(organizationId, projectId);
  }

  @Post("projects/:id/time-entries")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.HR_OFFICER,
  )
  @ApiOperation({ summary: "Create time entry (DRAFT)" })
  createTimeEntry(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Body() dto: CreatePsaTimeEntryDto,
  ) {
    return this.psa.createTimeEntry(organizationId, projectId, dto);
  }

  @Patch("projects/:projectId/time-entries/:entryId")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Update time entry (e.g. approve)" })
  patchTimeEntry(
    @OrganizationId() organizationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("entryId", new ParseUUIDPipe({ version: "4" })) entryId: string,
    @Body() dto: PatchPsaTimeEntryDto,
  ) {
    return this.psa.patchTimeEntry(organizationId, projectId, entryId, dto);
  }

  @Post("projects/:id/generate-invoice")
  @UseGuards(QuotaGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @CheckQuota(QuotaResource.INVOICES_PER_MONTH)
  @ApiOperation({ summary: "Create draft invoice from approved time entries" })
  generateInvoice(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Body() dto: GeneratePsaInvoiceDto,
  ) {
    return this.psa.generateInvoice(organizationId, projectId, dto);
  }

  @Get("projects/:id/profitability")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: "Project profitability snapshot" })
  profitability(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
  ) {
    return this.psa.profitability(organizationId, projectId, dateFrom, dateTo);
  }
}
