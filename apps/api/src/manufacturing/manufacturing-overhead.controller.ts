import {
  Body,
  Controller,
  Get,
  Param,
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
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { CreateOverheadDriverDto } from "./dto/create-overhead-driver.dto";
import { CreateOverheadPoolDto } from "./dto/create-overhead-pool.dto";
import { UpdateOverheadDriverDto } from "./dto/update-overhead-driver.dto";
import { AllocateOverheadBatchDto } from "./dto/allocate-overhead-batch.dto";
import { ManufacturingOverheadService } from "./manufacturing-overhead.service";

@ApiTags("manufacturing-overhead")
@ApiBearerAuth("bearer")
@Controller("manufacturing/overhead")
@UseGuards(SubscriptionGuard, RolesGuard)
@RequiresModule(ModuleEntitlement.MANUFACTURING)
export class ManufacturingOverheadController {
  constructor(private readonly overhead: ManufacturingOverheadService) {}

  @Get("period-summary")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Period summary: releases, allocations, suggested overhead from account 741 debits",
  })
  periodSummary(
    @OrganizationId() organizationId: string,
    @Query("period") period: string,
  ) {
    return this.overhead.getPeriodSummary(organizationId, period);
  }

  @Post("allocate-batch")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Create/update pool for period and allocate to selected releases (QUANTITY or MATERIAL_COST)",
  })
  allocateBatch(
    @OrganizationId() organizationId: string,
    @Body() dto: AllocateOverheadBatchDto,
  ) {
    return this.overhead.allocateBatch(organizationId, dto);
  }

  @Get("drivers")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "List overhead allocation drivers" })
  listDrivers(@OrganizationId() organizationId: string) {
    return this.overhead.listDrivers(organizationId);
  }

  @Post("drivers")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create overhead driver" })
  createDriver(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateOverheadDriverDto,
  ) {
    return this.overhead.createDriver(organizationId, dto);
  }

  @Patch("drivers/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Update overhead driver" })
  updateDriver(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOverheadDriverDto,
  ) {
    return this.overhead.updateDriver(organizationId, id, dto);
  }

  @Get("pools")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "List overhead pools (optional ?period=YYYY-MM)" })
  listPools(
    @OrganizationId() organizationId: string,
    @Query("period") period?: string,
  ) {
    return this.overhead.listPools(organizationId, period);
  }

  @Post("pools")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create overhead pool for a calendar month" })
  createPool(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateOverheadPoolDto,
  ) {
    return this.overhead.createPool(organizationId, dto);
  }

  @Post("allocate")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Allocate overhead pools for YYYY-MM to manufacturing releases (idempotent per pool+release)",
  })
  allocate(
    @OrganizationId() organizationId: string,
    @Query("period") period: string,
  ) {
    return this.overhead.allocatePeriod(organizationId, period);
  }
}
