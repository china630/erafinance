import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { ComplianceService } from "./compliance.service";
import { CouncilFacadeService } from "./council/council-facade.service";
import { DeliberateCouncilDto } from "./dto/deliberate-council.dto";
import { ListCouncilVerdictsQueryDto } from "./dto/list-council-verdicts-query.dto";
import { ListRiskAuditsQueryDto } from "./dto/list-risk-audits-query.dto";
import { PatchRiskAuditDto } from "./dto/patch-risk-audit.dto";

@ApiTags("compliance")
@ApiBearerAuth("bearer")
@Controller("compliance")
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@UseGuards(SubscriptionGuard, RolesGuard)
@RequiresModule(ModuleEntitlement.COMPLIANCE_PRO)
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly council: CouncilFacadeService,
  ) {}

  @Get("vat-threshold-monitor")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({
    summary:
      "YTD AZN turnover vs 200k VAT registration reference (Baku calendar year; cash-method linked + standalone payments)",
  })
  vatThresholdMonitor(@OrganizationId() organizationId: string) {
    return this.compliance.getVatThresholdMonitorSnapshot(organizationId);
  }

  @Get("risk-summary")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "ERM risk posture summary for header / dashboard" })
  getRiskSummary(@OrganizationId() organizationId: string) {
    return this.compliance.getRiskSummary(organizationId);
  }

  @Get("risk-audits")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "Paginated list of risk audit records" })
  listRiskAudits(
    @OrganizationId() organizationId: string,
    @Query() query: ListRiskAuditsQueryDto,
  ) {
    return this.compliance.listRiskAudits(organizationId, {
      status: query.status,
      type: query.type,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Post("council/deliberate")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Request Council of Elders AI deliberation (manual)" })
  deliberateCouncil(
    @OrganizationId() organizationId: string,
    @Body() body: DeliberateCouncilDto,
    @CurrentUser() user: AuthUser,
  ) {
    const target =
      body.riskAuditId != null
        ? {
            entityType: "RISK_AUDIT" as const,
            entityId: body.riskAuditId,
            label: `RiskAudit:${body.riskAuditId.slice(0, 8)}`,
          }
        : {
            entityType: body.targetEntityType ?? ("ORGANIZATION" as const),
            entityId: body.targetEntityId ?? organizationId,
            label: body.targetEntityId
              ? `${body.targetEntityType}:${body.targetEntityId.slice(0, 8)}`
              : "Organization",
          };

    return this.council.deliberate(organizationId, {
      triggerSource: "MANUAL",
      target,
      riskAuditId: body.riskAuditId,
      requestedByUserId: user.userId,
    });
  }

  @Get("council/verdicts")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "List Council verdicts" })
  listCouncilVerdicts(
    @OrganizationId() organizationId: string,
    @Query() query: ListCouncilVerdictsQueryDto,
  ) {
    return this.council.listVerdicts(organizationId, query);
  }

  @Get("council/verdicts/:id")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "Get Council verdict for Chamber UI" })
  getCouncilVerdict(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.council.getVerdict(organizationId, id);
  }

  @Patch("risk-audits/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Mitigate or ignore a pending risk alert" })
  patchRiskAudit(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: PatchRiskAuditDto,
  ) {
    return this.compliance.updateRiskAuditStatus(organizationId, id, {
      status: body.status,
      mitigationNote: body.mitigationNote,
    });
  }
}
