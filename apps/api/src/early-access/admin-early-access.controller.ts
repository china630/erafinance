import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { EarlyAccessModuleKey } from "@erafinance/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { EarlyAccessService } from "./early-access.service";

@ApiTags("admin")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/early-access")
export class AdminEarlyAccessController {
  constructor(private readonly earlyAccess: EarlyAccessService) {}

  @Get("summary")
  @ApiOperation({ summary: "Cross-tenant early access metrics (super-admin)" })
  summary() {
    return this.earlyAccess.getAdminSummary();
  }

  @Get("events")
  @ApiOperation({ summary: "Paginated raw funnel events" })
  events(
    @Query("moduleKey") moduleKeyRaw?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "50", 10) || 50),
    );
    const allowed = new Set<string>(Object.values(EarlyAccessModuleKey));
    const moduleKey =
      moduleKeyRaw && allowed.has(moduleKeyRaw)
        ? (moduleKeyRaw as EarlyAccessModuleKey)
        : undefined;
    return this.earlyAccess.getAdminEvents({ moduleKey, page, pageSize });
  }
}
