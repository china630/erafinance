import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { VoenIntegrityGuard } from "../auth/guards/voen-integrity.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { TaxService } from "./tax.service";

/**
 * Premium tax-reporting alias surface (`/api/tax-reports/*`), guarded like `TaxController`.
 */
@ApiTags("tax-reports")
@ApiBearerAuth("bearer")
@UseGuards(VoenIntegrityGuard)
@Controller("tax-reports")
export class TaxReportsController {
  constructor(private readonly tax: TaxService) {}

  @Get("taxpayer-info")
  @ApiOperation({
    summary:
      "VÖEN lookup (e-taxes.gov.az): same as GET /api/tax/taxpayer-info under tax-reports prefix",
  })
  taxpayerInfo(
    @OrganizationId() _organizationId: string,
    @Query("voen") voen: string,
  ) {
    return this.tax.lookupTaxpayerByVoen(voen ?? "");
  }
}
