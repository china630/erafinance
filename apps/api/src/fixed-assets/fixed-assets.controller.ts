import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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

  @Post("depreciation/run")
  @ApiOperation({
    summary:
      "Запустить амортизацию за месяц (STRAIGHT_LINE / REDUCING_BALANCE; Дт 713 — Кт 112; идемпотентно). UNITS_OF_PRODUCTION — через record-usage.",
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
