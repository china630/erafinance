import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BillingStatus, UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { AccessControlService } from "../access/access-control.service";
import { OrganizationId } from "../common/org-id.decorator";
import { QuotaService } from "../quota/quota.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "./subscription-access.service";
import { SelectPlanDto } from "./dto/select-plan.dto";
import { UpdateSubscriptionModulesDto } from "./dto/update-subscription-modules.dto";

@ApiTags("subscription")
@ApiBearerAuth("bearer")
@Controller("subscription")
export class SubscriptionController {
  constructor(
    private readonly access: SubscriptionAccessService,
    private readonly accessControl: AccessControlService,
    private readonly quota: QuotaService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("me")
  @ApiOperation({
    summary: "Текущий тариф, модули и квоты организации (для UI)",
  })
  async getMe(@OrganizationId() organizationId: string) {
    /** Сначала снимок подписки (lazy-create строки) — иначе квоты в parallel получают 404. */
    const snapshot = await this.access.getOrganizationSnapshot(organizationId);
    const [employees, invoicesThisMonth, storage, org] = await Promise.all([
      this.quota.getEmployeeQuotaSnapshot(organizationId),
      this.quota.getInvoiceMonthlyQuotaSnapshot(organizationId),
      this.quota.getStorageQuotaSnapshot(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          billingStatus: true,
          whatsappOutboundMessagesBalance: true,
        },
      }),
    ]);
    const expiresAt = snapshot.expiresAt;
    const now = Date.now();
    const readOnly =
      expiresAt != null && expiresAt.getTime() < now;

    let trialDaysLeft: number | null = null;
    if (snapshot.isTrial && expiresAt) {
      const expMs = expiresAt.getTime();
      if (expMs > now) {
        trialDaysLeft = Math.ceil((expMs - now) / 86_400_000);
      }
    }

    const waBalance = org?.whatsappOutboundMessagesBalance ?? 0;
    return {
      tier: snapshot.tier,
      activeModules: snapshot.activeModules,
      customConfig: snapshot.customConfig,
      modules: snapshot.modules,
      expiresAt: expiresAt?.toISOString() ?? null,
      isTrial: snapshot.isTrial,
      billingStatus: org?.billingStatus ?? BillingStatus.ACTIVE,
      readOnly,
      trialDaysLeft,
      quotas: {
        employees,
        invoicesThisMonth,
        storage,
        whatsappOutbound: {
          balance: waBalance,
          atLimit: waBalance <= 0,
        },
      },
    };
  }

  @Post("select-plan")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: "Смена тарифа (мок, без оплаты)" })
  async selectPlan(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
    @Body() dto: SelectPlanDto,
  ) {
    await this.accessControl.assertOwnerForBilling(user.userId, organizationId);
    await this.access.updateTier(organizationId, dto.tier);
    return this.getMe(organizationId);
  }

  @Patch("modules")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      "Включение/выключение модулей подписки (каталог + legacy production/ifrs)",
  })
  async patchModules(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateSubscriptionModulesDto,
  ) {
    await this.accessControl.assertOwnerForBilling(user.userId, organizationId);
    await this.access.updateModuleAddons(organizationId, dto);
    return this.getMe(organizationId);
  }
}
