import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { ReferralsService } from "./referrals.service";
import { CreateAdminPartnerDto, PatchAdminPartnerDto } from "./dto/admin-partner.dto";

@ApiTags("admin-referrals")
@ApiBearerAuth("bearer")
@Controller("admin/referrals")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get("partners")
  @ApiOperation({ summary: "List referral partners (super-admin)" })
  listPartners() {
    return this.referrals.listPartnersForAdmin();
  }

  @Post("partners")
  @ApiOperation({ summary: "Create referral partner (super-admin)" })
  createPartner(@Body() dto: CreateAdminPartnerDto) {
    return this.referrals.createPartnerForAdmin(dto);
  }

  @Patch("partners/:id")
  @ApiOperation({ summary: "Update referral partner (super-admin)" })
  patchPartner(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchAdminPartnerDto,
  ) {
    return this.referrals.updatePartnerForAdmin(id, dto);
  }

  @Get("partners/:id/qr.png")
  @ApiOperation({ summary: "Download partner QR PNG (super-admin)" })
  @ApiProduces("image/png")
  async partnerQr(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const buf = await this.referrals.renderPartnerQrPng(id);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
  }

  @Get("commissions")
  @ApiOperation({ summary: "List referral commissions (super-admin)" })
  listCommissions(
    @Query("partnerId", new DefaultValuePipe(undefined), new ParseUUIDPipe({ optional: true }))
    partnerId?: string,
  ) {
    return this.referrals.listCommissionsForAdmin(partnerId);
  }
}
