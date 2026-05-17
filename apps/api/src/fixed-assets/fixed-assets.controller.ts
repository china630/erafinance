import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { OrganizationId } from "../common/org-id.decorator";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";
import { RunMonthlyDepreciationDto } from "./dto/run-monthly-depreciation.dto";
import { RecordFixedAssetUsageDto } from "./dto/record-fixed-asset-usage.dto";
import { UpsertFixedAssetMonthlyUsageDto } from "./dto/upsert-monthly-usage.dto";
import { BulkFixedAssetMonthlyUsageDto } from "./dto/bulk-monthly-usage.dto";
import { UpdateFixedAssetDto } from "./dto/update-fixed-asset.dto";
import { FixedAssetsService } from "./fixed-assets.service";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";

@ApiTags("fixed-assets")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.FIXED_ASSETS)
@Controller("fixed-assets")
export class FixedAssetsController {
  constructor(private readonly assets: FixedAssetsService) {}

  @Get()
  @ApiOperation({ summary: "Список основных средств" })
  list(@OrganizationId() organizationId: string) {
    return this.assets.list(organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Создать ОС" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateFixedAssetDto,
  ) {
    return this.assets.create(organizationId, dto);
  }

  @Get("usage/monthly")
  @ApiOperation({ summary: "List UoP assets and logged monthly usage for a period" })
  listMonthlyUsage(
    @OrganizationId() organizationId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.assets.listMonthlyUsage(
      organizationId,
      Number(year),
      Number(month),
    );
  }

  @Post("usage/monthly/bulk")
  @ApiOperation({ summary: "Bulk upsert monthly production units (UoP) before depreciation close" })
  bulkMonthlyUsage(
    @OrganizationId() organizationId: string,
    @Body() dto: BulkFixedAssetMonthlyUsageDto,
  ) {
    return this.assets.bulkUpsertMonthlyUsage(organizationId, dto);
  }

  @Put(":id/monthly-usage")
  @ApiOperation({ summary: "Upsert monthly production units for one UoP asset" })
  upsertMonthlyUsage(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpsertFixedAssetMonthlyUsageDto,
  ) {
    return this.assets.upsertMonthlyUsage(organizationId, id, dto);
  }

  @Post("depreciation/run")
  @ApiOperation({
    summary:
      "Run monthly depreciation (SL/RB batch + UoP from monthly usage; Dr 713 / Cr 112)",
  })
  runMonthlyDepreciation(
    @OrganizationId() organizationId: string,
    @Body() dto: RunMonthlyDepreciationDto,
  ) {
    return this.assets.runMonthlyDepreciation(organizationId, {
      year: dto.year,
      month: dto.month,
    });
  }

  @Post(":id/record-usage")
  @ApiOperation({
    summary:
      "Внести выработку и начислить амортизацию (только UNITS_OF_PRODUCTION)",
  })
  recordUsage(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordFixedAssetUsageDto,
  ) {
    return this.assets.recordUsage(organizationId, id, dto.periodUnits);
  }

  @Get(":id")
  @ApiOperation({ summary: "ОС по id" })
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.assets.getOne(organizationId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить ОС" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFixedAssetDto,
  ) {
    return this.assets.update(organizationId, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить ОС" })
  remove(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.assets.remove(organizationId, id);
  }
}
