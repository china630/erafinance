import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CustomsTariffRatesService } from "../customs/customs-tariff-rates.service";
import { UpsertCustomsTariffRateDto } from "./dto/upsert-customs-tariff-rate.dto";

@ApiTags("admin")
@ApiBearerAuth("bearer")
@Controller("admin/customs-tariff-rates")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminCustomsTariffRatesController {
  constructor(private readonly tariffs: CustomsTariffRatesService) {}

  @Get()
  @ApiOperation({ summary: "List customs tariff rate rows (super-admin)" })
  list(@Query("includeInactive") includeInactive?: string) {
    const inc = includeInactive === "1" || includeInactive === "true";
    return this.tariffs.listForAdmin(inc);
  }

  @Post(":id/deactivate")
  @ApiOperation({ summary: "Deactivate tariff row (soft-delete via deletedAt)" })
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.tariffs.softDelete(id);
  }

  @Post(":id/restore")
  @ApiOperation({ summary: "Restore a deactivated tariff row" })
  restore(@Param("id", ParseUUIDPipe) id: string) {
    return this.tariffs.restore(id);
  }

  @Post()
  @ApiOperation({ summary: "Upsert a tariff rate by HS prefix" })
  upsert(@Body() dto: UpsertCustomsTariffRateDto) {
    return this.tariffs.upsertRate({
      hsCode: dto.hsCode,
      description: dto.description,
      dutyRatePercent: dto.dutyRatePercent,
      vatRatePercent: dto.vatRatePercent,
      excisePercent: dto.excisePercent ?? 0,
      effectiveFrom: dto.effectiveFrom ? new Date(`${dto.effectiveFrom.slice(0, 10)}T00:00:00.000Z`) : undefined,
      notes: dto.notes,
    });
  }
}
