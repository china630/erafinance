import { Controller, Get, Logger } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { AdminService } from "./admin.service";

/**
 * Public read-only pricing for landing pages (no JWT).
 * Same data plane as Super-Admin constructor; no organization or PII.
 */
@ApiTags("public-pricing")
@Public()
@SkipThrottle()
@Controller("public/pricing")
export class PublicPricingController {
  private readonly logger = new Logger(PublicPricingController.name);

  constructor(private readonly admin: AdminService) {}

  @Get()
  @ApiOperation({
    summary: "Public pricing catalog (Foundation, modules, bundles, tier quotas)",
    description:
      "Read-only snapshot for marketing sites. Currency AZN. Does not include internal bundle UUIDs or trial quota overrides JSON.",
  })
  async get() {
    try {
      return await this.admin.getPublicPricingSnapshot();
    } catch (e) {
      this.logger.warn(
        `public pricing fallback: ${e instanceof Error ? e.message : String(e)}`,
      );
      return {
        currency: "AZN" as const,
        foundationMonthlyAzn: 0,
        yearlyDiscountPercent: 0,
        pricingModules: [] as { key: string; name: string; pricePerMonth: number; sortOrder: number }[],
        pricingBundles: [] as {
          name: string;
          discountPercent: number;
          moduleKeys: string[];
          isTrialDefault: boolean;
          trialDurationDays: number | null;
        }[],
        tierLegacyPricePerMonthAzn: {},
        tierQuotasIncluded: {},
        quotaUnitPricing: null,
        ocrJobsPerOrgMonth: null,
        unavailable: true as const,
      };
    }
  }
}
