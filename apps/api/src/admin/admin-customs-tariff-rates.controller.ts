import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
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
  list() {
    return this.tariffs.listActiveForAdmin();
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

  @Delete(":id")
  @ApiOperation({ summary: "Soft-delete a tariff rate row" })
  softDelete(@Param("id", ParseUUIDPipe) id: string) {
    return this.tariffs.softDelete(id);
  }
}
