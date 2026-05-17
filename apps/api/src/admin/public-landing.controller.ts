import { Controller, Get, Logger } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { AdminService } from "./admin.service";

@ApiTags("public-landing")
@Public()
@SkipThrottle()
@Controller("public/landing-modules")
export class PublicLandingController {
  private readonly logger = new Logger(PublicLandingController.name);

  constructor(private readonly admin: AdminService) {}

  @Get()
  @ApiOperation({ summary: "Public landing page module cards (AZ/RU marketing copy)" })
  async list() {
    try {
      return await this.admin.listPublicLandingModules();
    } catch (e) {
      this.logger.warn(
        `public landing-modules fallback: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { items: [] as unknown[], unavailable: true as const };
    }
  }
}
