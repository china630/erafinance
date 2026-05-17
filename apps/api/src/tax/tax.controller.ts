import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { VoenIntegrityGuard } from "../auth/guards/voen-integrity.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { TaxService } from "./tax.service";

@ApiTags("tax")
@ApiBearerAuth("bearer")
@UseGuards(VoenIntegrityGuard)
@Controller("tax")
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get("taxpayer-info")
  @ApiOperation({
    summary:
      "VÖEN lookup (e-taxes.gov.az): ad, ünvan, ƏDV statusu + riskli vergi ödəyicisi flag",
  })
  taxpayerInfo(
    @OrganizationId() _organizationId: string,
    @Query("voen") voen: string,
  ) {
    return this.tax.lookupTaxpayerByVoen(voen ?? "");
  }
}
