import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AuthService } from "../auth/auth.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { AdminCatalogService } from "./admin-catalog.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { AdminService } from "./admin.service";
import { AdminSubscriptionPatchDto } from "./dto/admin-subscription-patch.dto";
import {
  CreatePricingBundleDto,
  UpdatePricingBundleDto,
} from "./dto/pricing-bundle.dto";
import { PatchPricingBundleTrialConfigDto } from "./dto/pricing-bundle-trial-config.dto";
import { PatchBillingGlobalLimitsDto } from "./dto/patch-billing-global-limits.dto";
import { PatchBillingPricingCatalogDto } from "./dto/patch-billing-pricing-catalog.dto";
import { PatchFoundationDto } from "./dto/patch-foundation.dto";
import { PatchPricingModulePriceDto } from "./dto/patch-pricing-module-price.dto";
import { PatchOcrJobsPerOrgMonthDto } from "./dto/patch-ocr-jobs-per-org-month.dto";
import { PatchQuotaUnitPricingDto } from "./dto/patch-quota-unit-pricing.dto";
import { PatchYearlyDiscountDto } from "./dto/patch-yearly-discount.dto";
import { SetBillingPriceDto } from "./dto/set-billing-price.dto";
import { PatchMeterUnitPricingDto } from "./dto/patch-meter-unit-pricing.dto";
import { PatchTierSpendCeilingsDto } from "./dto/patch-tier-spend-ceilings.dto";
import { SetBillingQuotasMatrixDto } from "./dto/set-billing-quotas-matrix.dto";
import { SetTierQuotasDto } from "./dto/set-tier-quotas.dto";
import { TranslationUpsertDto } from "./dto/translation-upsert.dto";
import { UpsertChartTemplateEntryDto } from "./dto/upsert-chart-template-entry.dto";
import { PatchChartTemplateEntryDto } from "./dto/patch-chart-template-entry.dto";
import { PatchLandingModuleMarketingDto } from "./dto/patch-landing-module-marketing.dto";
import { PatchTranslationOverrideDto } from "./dto/patch-translation-override.dto";
import { PutSystemConfigDto } from "./dto/put-system-config.dto";
import { CreateCurrencyDto, PatchCurrencyDto } from "./dto/admin-currency.dto";
import {
  CreateUnitOfMeasureDto,
  PatchUnitOfMeasureDto,
} from "./dto/admin-unit-of-measure.dto";
import { CreateTaxRateDto, PatchTaxRateDto } from "./dto/admin-tax-rate.dto";
import {
  PatchTemplateAccountDto,
  UpsertTemplateAccountDto,
} from "./dto/admin-template-account.dto";

@ApiTags("admin")
@ApiBearerAuth("bearer")
@Controller("admin")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly auth: AuthService,
    private readonly systemConfig: SystemConfigService,
    private readonly catalog: AdminCatalogService,
  ) {}

  @Get("stats")
  @ApiOperation({ summary: "Сводная статистика платформы" })
  stats() {
    return this.admin.getStats();
  }

  /** Должен быть объявлен до GET users, иначе сегмент `users` перехватится как :userId. */
  @Get("users/:userId/organizations")
  @ApiOperation({
    summary: "Организации пользователя и подписки (супер-админ, без фильтра тенанта)",
  })
  userOrganizations(@Param("userId", ParseUUIDPipe) userId: string) {
    return this.admin.getUserOrganizations(userId);
  }

  @Get("users")
  @ApiOperation({
    summary: "Список всех пользователей платформы (пагинация, поиск по email/имени)",
  })
  users(@Query("q") q?: string, @Query("page") pageRaw?: string, @Query("pageSize") pageSizeRaw?: string) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "20", 10) || 20),
    );
    return this.admin.listUsers(q, page, pageSize);
  }

  @Get("organizations")
  @ApiOperation({ summary: "Список организаций (пагинация, поиск по VÖEN/названию)" })
  organizations(@Query("q") q?: string, @Query("page") pageRaw?: string, @Query("pageSize") pageSizeRaw?: string) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "20", 10) || 20),
    );
    return this.admin.listOrganizations(q, page, pageSize);
  }

  @Patch("organizations/:id/subscription")
  @ApiOperation({
    summary: "Принудительное продление / блокировка / смена тарифа",
  })
  patchSubscription(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminSubscriptionPatchDto,
  ) {
    return this.admin.patchSubscription(id, dto);
  }

  @Get("config/billing")
  @ApiOperation({ summary: "Цены и квоты по тарифам (SystemConfig)" })
  billingConfig() {
    return this.admin.getBillingConfig();
  }

  @Patch("config/billing/price")
  @ApiOperation({ summary: "Установить цену тарифа (AZN/мес.)" })
  setPrice(@Body() dto: SetBillingPriceDto) {
    return this.admin.setBillingPrice(dto);
  }

  @Patch("config/billing/quotas")
  @ApiOperation({ summary: "Установить квоты тарифа" })
  setQuotas(@Body() dto: SetTierQuotasDto) {
    return this.admin.setTierQuotas(dto);
  }

  @Patch("config/billing/quotas-matrix")
  @ApiOperation({
    summary: "@deprecated Legacy cap matrix — prefer meter-unit-pricing + tier-spend-ceilings",
  })
  setQuotasMatrix(@Body() dto: SetBillingQuotasMatrixDto) {
    return this.admin.setBillingQuotasMatrix(dto);
  }

  @Patch("config/billing/meter-unit-pricing")
  @ApiOperation({ summary: "Spend-tier meter unit prices (AZN)" })
  patchMeterUnitPricing(@Body() dto: PatchMeterUnitPricingDto) {
    return this.admin.patchMeterUnitPricing(dto);
  }

  @Patch("config/billing/tier-spend-ceilings")
  @ApiOperation({ summary: "Monthly spend ceiling per TariffTier (AZN, Baku month)" })
  patchTierSpendCeilings(@Body() dto: PatchTierSpendCeilingsDto) {
    return this.admin.patchTierSpendCeilings(dto);
  }

  @Patch("config/billing/foundation")
  @ApiOperation({ summary: "Базовая цена платформы (Foundation), AZN/мес." })
  patchFoundation(@Body() dto: PatchFoundationDto) {
    return this.admin.patchFoundation(dto);
  }

  @Patch("config/billing/pricing-catalog")
  @ApiOperation({
    summary:
      "Foundation + все цены pricing_modules в одной транзакции (Super-Admin Прайс-лист)",
  })
  patchBillingPricingCatalog(@Body() dto: PatchBillingPricingCatalogDto) {
    return this.admin.patchBillingPricingCatalog(dto);
  }

  @Patch("config/billing/global-limits")
  @ApiOperation({
    summary:
      "Годовая скидка, OCR/мес., unit pricing квот, legacy billing.price.* — одна транзакция",
  })
  patchBillingGlobalLimits(@Body() dto: PatchBillingGlobalLimitsDto) {
    return this.admin.patchBillingGlobalLimits(dto);
  }

  @Patch("config/billing/yearly-discount")
  @ApiOperation({ summary: "Скидка при годовой оплате (%)" })
  patchYearlyDiscount(@Body() dto: PatchYearlyDiscountDto) {
    return this.admin.patchYearlyDiscount(dto);
  }

  @Patch("config/billing/quota-pricing")
  @ApiOperation({ summary: "Цены за единицы расширения квот (блоки сотрудников, документов)" })
  patchQuotaPricing(@Body() dto: PatchQuotaUnitPricingDto) {
    return this.admin.patchQuotaUnitPricing(dto);
  }

  @Patch("config/billing/ocr-jobs-per-org-month")
  @ApiOperation({
    summary: "Лимит OCR-задач на организацию за UTC-месяц (trade_pro)",
  })
  patchOcrJobsPerOrgMonth(@Body() dto: PatchOcrJobsPerOrgMonthDto) {
    return this.admin.patchOcrJobsPerOrgMonth(dto);
  }

  @Post("config/billing/seed-pricing")
  @ApiOperation({
    summary:
      "v8.9.3: сброс каталога модулей к дефолтам (Banking, Kassa, HR, Warehouse)",
  })
  seedPricingCatalog() {
    return this.admin.seedPricingCatalogDefaults();
  }

  @Patch("pricing-modules/:idOrKey")
  @ApiOperation({
    summary:
      "Обновить цену модуля в каталоге (id = UUID или key = slug, например tax_pro)",
  })
  patchPricingModule(
    @Param("idOrKey") idOrKey: string,
    @Body() dto: PatchPricingModulePriceDto,
  ) {
    return this.admin.patchPricingModulePrice(idOrKey, dto);
  }

  @Post("pricing-bundles")
  @ApiOperation({ summary: "Создать пакет (bundle) для конструктора" })
  createPricingBundle(@Body() dto: CreatePricingBundleDto) {
    return this.admin.createPricingBundle(dto);
  }

  @Patch("pricing-bundles/:id")
  @ApiOperation({ summary: "Обновить пакет" })
  updatePricingBundle(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricingBundleDto,
  ) {
    return this.admin.updatePricingBundle(id, dto);
  }

  @Patch("pricing-bundles/:id/trial-config")
  @ApiOperation({ summary: "Trial package flags and quota overrides for a bundle" })
  patchPricingBundleTrialConfig(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchPricingBundleTrialConfigDto,
  ) {
    return this.admin.patchPricingBundleTrialConfig(id, dto);
  }

  @Delete("pricing-bundles/:id")
  @ApiOperation({ summary: "Удалить пакет" })
  deletePricingBundle(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.deletePricingBundle(id);
  }

  @Get("landing-modules")
  @ApiOperation({ summary: "List landing page marketing blocks" })
  listLandingModules() {
    return this.admin.listLandingModulesAdmin();
  }

  @Patch("landing-modules/:moduleSlug")
  @ApiOperation({ summary: "Update landing page marketing block" })
  patchLandingModule(
    @Param("moduleSlug") moduleSlug: string,
    @Body() dto: PatchLandingModuleMarketingDto,
  ) {
    return this.admin.patchLandingModuleMarketing(moduleSlug, dto);
  }

  @Get("translations")
  @ApiOperation({
    summary:
      "Список ключей i18n: дефолты из resources + переопределения из БД",
  })
  translations(
    @Query("locale") locale = "az",
    @Query("q") q?: string,
    @Query("skip") skipRaw?: string,
    @Query("take") takeRaw?: string,
  ) {
    const skip = Math.max(0, Number.parseInt(skipRaw ?? "0", 10) || 0);
    const take = Math.min(
      50000,
      Math.max(1, Number.parseInt(takeRaw ?? "20000", 10) || 20000),
    );
    return this.admin.listTranslations(locale, q, skip, take);
  }

  @Post("translations")
  @ApiOperation({ summary: "Создать или обновить строку перевода" })
  upsertTranslation(@Body() dto: TranslationUpsertDto) {
    return this.admin.upsertTranslation(dto);
  }

  @Patch("translations/:id")
  @ApiOperation({ summary: "Update translation override value and/or soft-disable (no hard delete)" })
  patchTranslation(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchTranslationOverrideDto,
  ) {
    return this.admin.patchTranslationOverride(id, dto);
  }

  @Post("translations/sync")
  @ApiOperation({
    summary: "Сбросить версию кэша i18n (клиенты перезагружают переводы)",
  })
  syncTranslations() {
    return this.admin.syncTranslationsCache();
  }

  @Get("audit-logs")
  @ApiOperation({ summary: "Глобальный журнал AuditLog" })
  auditLogs(
    @Query("organizationId") organizationId?: string,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("skip") skipRaw?: string,
    @Query("take") takeRaw?: string,
  ) {
    const skip = Math.max(0, Number.parseInt(skipRaw ?? "0", 10) || 0);
    const take = Math.min(
      200,
      Math.max(1, Number.parseInt(takeRaw ?? "50", 10) || 50),
    );
    return this.admin.globalAuditLogs({
      organizationId,
      userId,
      from,
      to,
      skip,
      take,
    });
  }

  @Get("chart-template")
  @ApiOperation({
    summary:
      "Глобальный шаблон NAS (chart_of_accounts_entries) — источник для новых организаций",
  })
  chartTemplateList(@Query("withUsage") withUsage?: string) {
    const inc = withUsage === "1" || withUsage === "true";
    return this.admin.listChartTemplateEntries(inc);
  }

  @Patch("chart-template/:id")
  @ApiOperation({ summary: "Частичное обновление строки NAS шаблона (kind/code неизменны)" })
  chartTemplatePatch(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchChartTemplateEntryDto,
  ) {
    return this.admin.patchChartTemplateEntry(id, dto);
  }

  @Post("chart-template")
  @ApiOperation({ summary: "Создать или обновить строку глобального плана NAS" })
  chartTemplateUpsert(@Body() dto: UpsertChartTemplateEntryDto) {
    return this.admin.upsertChartTemplateEntry(dto);
  }

  @Get("system-config")
  @ApiOperation({ summary: "Platform system_config rows (whitelist, Super-Admin)" })
  listSystemConfig() {
    return this.systemConfig.listAdminSystemConfigRows();
  }

  @Put("system-config/:key")
  @ApiOperation({ summary: "Upsert a whitelisted system_config key" })
  putSystemConfig(@Param("key") key: string, @Body() dto: PutSystemConfigDto) {
    return this.systemConfig
      .putAdminSystemConfig(decodeURIComponent(key), dto.value)
      .then(() => ({ ok: true }));
  }

  @Post("system-config/:key/reset")
  @ApiOperation({ summary: "Remove DB row so built-in defaults apply" })
  resetSystemConfig(@Param("key") key: string) {
    return this.systemConfig
      .resetAdminSystemConfig(decodeURIComponent(key))
      .then(() => ({ ok: true }));
  }

  @Get("currencies")
  @ApiOperation({ summary: "All currencies with relation usage counts" })
  adminCurrencies() {
    return this.catalog.listCurrencies();
  }

  @Post("currencies")
  @ApiOperation({ summary: "Create currency" })
  adminCreateCurrency(@Body() dto: CreateCurrencyDto) {
    return this.catalog.createCurrency(dto);
  }

  @Patch("currencies/:id")
  @ApiOperation({ summary: "Patch currency (code immutable)" })
  adminPatchCurrency(@Param("id", ParseUUIDPipe) id: string, @Body() dto: PatchCurrencyDto) {
    return this.catalog.patchCurrency(id, dto);
  }

  @Get("units-of-measure")
  @ApiOperation({ summary: "Units of measure with usage counts" })
  adminUom() {
    return this.catalog.listUnitsOfMeasure();
  }

  @Post("units-of-measure")
  @ApiOperation({ summary: "Create unit of measure" })
  adminCreateUom(@Body() dto: CreateUnitOfMeasureDto) {
    return this.catalog.createUnitOfMeasure(dto);
  }

  @Patch("units-of-measure/:id")
  @ApiOperation({ summary: "Patch unit of measure (code immutable)" })
  adminPatchUom(@Param("id", ParseUUIDPipe) id: string, @Body() dto: PatchUnitOfMeasureDto) {
    return this.catalog.patchUnitOfMeasure(id, dto);
  }

  @Get("tax-rates")
  @ApiOperation({ summary: "Tax rates with usage counts" })
  adminTaxRates() {
    return this.catalog.listTaxRates();
  }

  @Post("tax-rates")
  @ApiOperation({ summary: "Create tax rate" })
  adminCreateTaxRate(@Body() dto: CreateTaxRateDto) {
    return this.catalog.createTaxRate(dto);
  }

  @Patch("tax-rates/:id")
  @ApiOperation({ summary: "Patch tax rate (code immutable)" })
  adminPatchTaxRate(@Param("id", ParseUUIDPipe) id: string, @Body() dto: PatchTaxRateDto) {
    return this.catalog.patchTaxRate(id, dto);
  }

  @Get("template-accounts")
  @ApiOperation({ summary: "Global NAS template accounts" })
  adminTemplateAccounts() {
    return this.catalog.listTemplateAccounts();
  }

  @Post("template-accounts")
  @ApiOperation({ summary: "Upsert template account row" })
  adminUpsertTemplateAccount(@Body() dto: UpsertTemplateAccountDto) {
    return this.catalog.upsertTemplateAccount(dto);
  }

  @Patch("template-accounts/:id")
  @ApiOperation({ summary: "Patch template account row" })
  adminPatchTemplateAccount(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchTemplateAccountDto,
  ) {
    return this.catalog.patchTemplateAccount(id, dto);
  }

  @Get("mdm/companies")
  @ApiOperation({ summary: "Global company directory (read-only)" })
  adminMdmCompanies(
    @Query("q") q?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "25", 10) || 25),
    );
    return this.catalog.listGlobalCompanies(q, page, pageSize);
  }

  @Get("mdm/counterparties")
  @ApiOperation({ summary: "Global counterparties MDM (read-only)" })
  adminMdmCounterparties(
    @Query("q") q?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "25", 10) || 25),
    );
    return this.catalog.listGlobalCounterparties(q, page, pageSize);
  }

  @Get("reference/snapshot")
  @ApiOperation({ summary: "Enums and contract whitelists (read-only)" })
  adminReferenceSnapshot() {
    return this.catalog.getReferenceSnapshot();
  }

  @Post("impersonate/:userId")
  @ApiOperation({
    summary: "Войти от имени пользователя (поддержка); refresh — в cookie",
  })
  async impersonate(
    @CurrentUser() admin: AuthUser,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.impersonate(admin.userId, userId);
    this.auth.setRefreshCookie(res, out.refreshToken);
    const { refreshToken: _r, ...body } = out;
    return body;
  }
}
