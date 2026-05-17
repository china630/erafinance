import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { BankStatementChannel } from "@erafinance/database";
import { UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { requireOrgRole } from "../auth/require-org-role";
import { OrganizationId } from "../common/org-id.decorator";
import { parseLedgerTypeQuery } from "../common/ledger-type.util";
import { BankIntegrationService } from "./bank-integration.service";
import { BankMatchService } from "./bank-match.service";
import { BankingDirectSettingsService } from "./banking-direct-settings.service";
import { BankingService } from "./banking.service";
import { BankingGatewayService } from "./banking-gateway.service";
import { PatchBankingDirectDto } from "./dto/patch-banking-direct.dto";
import { CashOutDto } from "./dto/cash-out.dto";
import { CreateBankConversionDto } from "./dto/create-bank-conversion.dto";
import { CreateCashDepositDto } from "./dto/create-cash-deposit.dto";
import { CreateInternalTransferDto } from "./dto/create-internal-transfer.dto";
import { CreateOrganizationBankAccountDto } from "./dto/create-organization-bank-account.dto";
import { ManualBankEntryDto } from "./dto/manual-bank-entry.dto";
import { MatchBankLineDto } from "./dto/match-line.dto";
import { SendAllPendingPaymentDraftsDto } from "./dto/send-all-pending-payment-drafts.dto";
import { SendBankPaymentDraftDto } from "./dto/send-bank-payment-draft.dto";
import { UpdateOrganizationBankAccountDto } from "./dto/update-organization-bank-account.dto";
import { ValidateIbanDto } from "./dto/validate-iban.dto";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { IbanValidationService } from "./iban-validation.service";
import { IntegrationReliabilityService } from "../integrations/integration-reliability.service";

@ApiTags("banking")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.BANKING_PRO)
@Controller("banking")
export class BankingController {
  constructor(
    private readonly banking: BankingService,
    private readonly gateway: BankingGatewayService,
    private readonly bankMatch: BankMatchService,
    private readonly bankIntegration: BankIntegrationService,
    private readonly ibanValidation: IbanValidationService,
    private readonly reliability: IntegrationReliabilityService,
    private readonly bankingDirectSettings: BankingDirectSettingsService,
  ) {}

  @Get("account-cards")
  @ApiOperation({
    summary:
      "Карточки по счетам кассы (101*) и банка (221–224) — сальдо по ОСВ",
  })
  accountCards(
    @OrganizationId() organizationId: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    const lt = parseLedgerTypeQuery(ledgerType);
    return this.banking.getAccountCards(organizationId, lt);
  }

  @Get("balances")
  @ApiOperation({
    summary:
      "Unified balances across connected bank providers (Pasha/ABB/Birbank) by organization bankKey",
  })
  balances(@OrganizationId() organizationId: string) {
    return this.gateway.getBalances(organizationId);
  }

  @Get("direct-settings")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Masked Open Banking / REST sync settings (URLs, token presence; no raw secrets)",
  })
  getDirectSettings(@OrganizationId() organizationId: string) {
    return this.bankingDirectSettings.getView(organizationId);
  }

  @Patch("direct-settings")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update direct banking REST settings (per-bank URL, token)" })
  patchDirectSettings(
    @OrganizationId() organizationId: string,
    @Body() dto: PatchBankingDirectDto,
  ) {
    return this.bankingDirectSettings.patch(organizationId, dto);
  }

  @Post("import")
  @ApiOperation({ summary: "Загрузка CSV выписки (ABB, Pasha и др.)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        bankName: { type: "string", example: "Pasha Bank" },
        channel: { type: "string", enum: ["BANK", "CASH"] },
      },
      required: ["file", "bankName"],
    },
  })
  @UseInterceptors(FileInterceptor("file"))
  async importCsv(
    @OrganizationId() organizationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("bankName") bankName?: string,
    @Body("channel") channelRaw?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("file required");
    }
    const name = (bankName ?? "").trim();
    if (!name) {
      throw new BadRequestException("bankName required");
    }
    const channel = this.parseStatementChannel(channelRaw);
    return this.banking.importCsv(
      organizationId,
      file.buffer,
      name,
      file.originalname,
      channel,
    );
  }

  @Post("cash-out")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: "Нəqd məxaric: Дт 731 / Кт 101.01 + строка реестра (касса)",
  })
  cashOut(
    @OrganizationId() organizationId: string,
    @Body() dto: CashOutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.banking.manualCashOut(organizationId, dto, requireOrgRole(user));
  }

  @Post("manual-entry")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Ручная банковская операция: проводка (Дт/Кт банк + второй счёт) + строка реестра",
  })
  manualBankEntry(
    @OrganizationId() organizationId: string,
    @Body() dto: ManualBankEntryDto,
    @CurrentUser() user: AuthUser,
  ) {
    requireOrgRole(user);
    return this.banking.manualBankEntry(organizationId, dto);
  }

  @Get("bank-accounts")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "CRUD: list organization bank accounts" })
  listBankAccounts(@OrganizationId() organizationId: string) {
    return this.banking.listOrganizationBankAccounts(organizationId);
  }

  @Post("bank-accounts")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "CRUD: create organization bank account" })
  createBankAccount(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateOrganizationBankAccountDto,
  ) {
    return this.banking.createOrganizationBankAccount(organizationId, dto);
  }

  @Patch("bank-accounts/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "CRUD: update organization bank account" })
  updateBankAccount(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOrganizationBankAccountDto,
  ) {
    return this.banking.updateOrganizationBankAccount(organizationId, id, dto);
  }

  @Delete("bank-accounts/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "CRUD: archive/delete organization bank account" })
  deleteBankAccount(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.banking.deleteOrganizationBankAccount(organizationId, id);
  }

  @Post("transfers")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Внутренний перевод между своими счетами (через транзит 231, комиссия на 731)",
  })
  createInternalTransfer(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateInternalTransferDto,
    @CurrentUser() user: AuthUser,
  ) {
    requireOrgRole(user);
    return this.banking.createInternalTransfer(organizationId, dto);
  }

  @Post("conversions")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Конвертация между своими валютными счетами с расчётом курсовой разницы (662/762)",
  })
  createConversion(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateBankConversionDto,
    @CurrentUser() user: AuthUser,
  ) {
    requireOrgRole(user);
    return this.banking.createBankConversion(organizationId, dto);
  }

  @Post("cash-deposits")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Взнос наличных на банковский счет (источник: касса 251 или средства учредителя 545)",
  })
  createCashDeposit(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateCashDepositDto,
    @CurrentUser() user: AuthUser,
  ) {
    requireOrgRole(user);
    return this.banking.createCashDeposit(organizationId, dto);
  }

  @Post("validate-iban")
  @ApiOperation({
    summary:
      "Deep IBAN validation via provider (available for ENTERPRISE or banking_pro module)",
  })
  validateIban(
    @OrganizationId() organizationId: string,
    @Body() dto: ValidateIbanDto,
  ) {
    return this.ibanValidation.validateViaProvider(organizationId, dto.iban);
  }

  private parseStatementChannel(raw: string | undefined): BankStatementChannel {
    const u = (raw ?? "").trim().toUpperCase();
    if (u === "" || u === "BANK") return BankStatementChannel.BANK;
    if (u === "CASH") return BankStatementChannel.CASH;
    throw new BadRequestException('Invalid channel (use "BANK" or "CASH")');
  }

  @Get("statements")
  @ApiOperation({ summary: "Список загруженных выписок" })
  listStatements(@OrganizationId() organizationId: string) {
    return this.banking.listStatements(organizationId);
  }

  @Get("payment-drafts")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Исходящие платежные драфты в банк" })
  listPaymentDrafts(
    @OrganizationId() organizationId: string,
    @Query("status") status?: string,
  ) {
    const s = (status ?? "").trim().toUpperCase();
    const allowed = ["PENDING", "SENT", "REJECTED", "COMPLETED"] as const;
    const st = (allowed as readonly string[]).find((x) => x === s) as
      | (typeof allowed)[number]
      | undefined;
    return this.banking.listPaymentDrafts(organizationId, st);
  }

  @Post("payment-drafts/send-all")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Отправить все черновики исходящих платежей (PENDING) в direct banking по очереди",
  })
  sendAllPendingPaymentDrafts(
    @OrganizationId() organizationId: string,
    @Body() dto: SendAllPendingPaymentDraftsDto,
  ) {
    return this.gateway.sendAllPendingPaymentDrafts(organizationId, dto.fromAccountIban);
  }

  @Post("payment-drafts/send")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Отправка исходящего платежа в direct banking адаптер" })
  sendPaymentDraft(
    @OrganizationId() organizationId: string,
    @Body() dto: SendBankPaymentDraftDto,
  ) {
    return this.gateway.sendPaymentDraft(organizationId, {
      fromAccountIban: dto.fromAccountIban,
      recipientIban: dto.recipientIban,
      amount: dto.amount.toFixed(4),
      currency: dto.currency,
      purpose: dto.purpose,
      provider: dto.provider,
    });
  }

  @Post("sync")
  @ApiOperation({
    summary:
      "Direct Banking: ручная синхронизация (mock Pasha + ABB), автосверка уникальных кандидатов",
  })
  async triggerDirectSync(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    await this.reliability.executeWithPolicies({
      provider: "banking_manual_sync",
      operation: "direct_sync",
      writeIdempotencyKey:
        idempotencyKey?.trim() || `${organizationId}:${user.userId}:direct_sync`,
      request: async () => Promise.resolve({ ok: true }),
    });
    return this.bankIntegration.runDirectSync(organizationId, "manual");
  }

  @Get("sync/status")
  @ApiOperation({
    summary: "Статус последней синхронизации и URL вебхука для банка",
  })
  directSyncStatus(@OrganizationId() organizationId: string) {
    return this.bankIntegration.getSyncStatus(organizationId);
  }

  @Get("lines")
  @ApiOperation({ summary: "Строки выписок (операции), с пагинацией" })
  listLines(
    @OrganizationId() organizationId: string,
    @Query("bankStatementId") bankStatementId?: string,
    @Query("unmatchedOnly") unmatchedOnly?: string,
    @Query("needsAttention") needsAttention?: string,
    @Query("channel") channel?: string,
    @Query("bankOnly") bankOnly?: string,
    @Query("valueDateFrom") valueDateFrom?: string,
    @Query("valueDateTo") valueDateTo?: string,
    @Query("page") pageStr?: string,
    @Query("pageSize") pageSizeStr?: string,
  ) {
    const ch = channel?.trim().toUpperCase();
    const channelFilter =
      ch === "BANK" || ch === "CASH" ? ch : undefined;
    const from = valueDateFrom?.trim();
    const to = valueDateTo?.trim();
    const page = Math.max(1, Math.trunc(Number(pageStr) || 1));
    const pageSizeRaw = Math.trunc(Number(pageSizeStr) || 25);
    const pageSize = Math.min(200, Math.max(1, pageSizeRaw));
    return this.banking.listLines(organizationId, {
      bankStatementId: bankStatementId || undefined,
      unmatchedOnly: unmatchedOnly === "1" || unmatchedOnly === "true",
      needsAttention: needsAttention === "1" || needsAttention === "true",
      channel: channelFilter,
      bankOnly: bankOnly === "1" || bankOnly === "true",
      valueDateFrom: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
      valueDateTo: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
      page,
      pageSize,
    });
  }

  @Get("lines/:lineId/candidates")
  @ApiOperation({
    summary: "Инвойсы-кандидаты для сверки (сумма + VÖEN)",
  })
  candidates(
    @OrganizationId() organizationId: string,
    @Param("lineId") lineId: string,
  ) {
    return this.bankMatch.findCandidates(organizationId, lineId);
  }

  @Post("lines/:lineId/match")
  @ApiOperation({
    summary:
      "Подтвердить Match: PAID + проводка, либо только привязка если инвойс уже PAID",
  })
  match(
    @OrganizationId() organizationId: string,
    @Param("lineId") lineId: string,
    @Body() dto: MatchBankLineDto,
  ) {
    return this.bankMatch.confirmMatch(
      organizationId,
      lineId,
      dto.invoiceId,
    );
  }
}
