import { BadRequestException, Injectable } from "@nestjs/common";
import {
  BankStatementChannel,
  BankStatementLineOrigin,
  BankStatementLineType,
  Decimal,
  LedgerType,
  pickAccountDisplayName,
  type Prisma,
  type UserRole,
} from "@erafinance/database";
import { assertMayPostManualJournal } from "../auth/policies/invoice-finance.policy";
import { AccountingService } from "../accounting/accounting.service";
import { BankSubaccountService } from "../accounting/bank-subaccount.service";
import {
  CASH_OPERATIONAL_ACCOUNT_CODE,
  CASH_IN_TRANSIT_ACCOUNT_CODE,
  FOUNDER_FUNDS_ACCOUNT_CODE,
  FX_GAIN_ACCOUNT_CODE,
  FX_LOSS_ACCOUNT_CODE,
  MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
  TRANSIT_TRANSFER_ACCOUNT_CODE,
} from "../ledger.constants";
import { PrismaService } from "../prisma/prisma.service";
import { ReportingService } from "../reporting/reporting.service";
import { endOfUtcDay, parseIsoDateOnly } from "../reporting/reporting-period.util";
import { TreasuryService } from "../treasury/treasury.service";
import { parseBankStatementCsv } from "./csv/bank-csv.parser";
import type { CreateBankConversionDto } from "./dto/create-bank-conversion.dto";
import type { CreateCashDepositDto } from "./dto/create-cash-deposit.dto";
import type { CreateInternalTransferDto } from "./dto/create-internal-transfer.dto";
import type { CreateOrganizationBankAccountDto } from "./dto/create-organization-bank-account.dto";
import type { UpdateOrganizationBankAccountDto } from "./dto/update-organization-bank-account.dto";

function matchesPrefix(accountCode: string, prefix: string): boolean {
  return accountCode === prefix || accountCode.startsWith(`${prefix}.`);
}

function matchesAnyRoot(
  accountCode: string,
  roots: readonly string[],
): boolean {
  return roots.some((r) => matchesPrefix(accountCode, r));
}

function maskAccountCode(code: string): string {
  const digits = code.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `••••${digits.slice(-4)}`;
  }
  if (code.length >= 4) {
    return `••••${code.slice(-4)}`;
  }
  return "••••";
}

function isBankLedgerAccountCode(code: string): boolean {
  const c = code.trim();
  if (c === "221" || c.startsWith("221.")) return true;
  for (const r of ["222", "223", "224"] as const) {
    if (c === r || c.startsWith(`${r}.`)) return true;
  }
  return false;
}

function segmentForAccountCode(
  code: string,
): "CASH" | "BANK" | null {
  if (matchesPrefix(code, "101")) return "CASH";
  if (
    matchesPrefix(code, "221") ||
    matchesAnyRoot(code, ["222", "223", "224"])
  ) {
    return "BANK";
  }
  return null;
}

@Injectable()
export class BankingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService,
    private readonly accounting: AccountingService,
    private readonly treasury: TreasuryService,
    private readonly bankSubaccount: BankSubaccountService,
  ) {}

  async importCsv(
    organizationId: string,
    buffer: Buffer,
    bankName: string,
    sourceFileName?: string,
    channel: BankStatementChannel = BankStatementChannel.BANK,
  ) {
    const text = buffer.toString("utf-8");
    const rows = parseBankStatementCsv(text);
    if (rows.length === 0) {
      throw new BadRequestException("No rows parsed from CSV");
    }

    let totalAbs = new Decimal(0);
    let stmtDate: Date | null = null;
    for (const r of rows) {
      totalAbs = totalAbs.add(r.amount);
      if (r.valueDate) {
        if (!stmtDate || r.valueDate > stmtDate) stmtDate = r.valueDate;
      }
    }

    const date = stmtDate ?? new Date();

    const { out, createdLines } = await this.prisma.$transaction(async (tx) => {
      const stmt = await tx.bankStatement.create({
        data: {
          organizationId,
          date,
          totalAmount: totalAbs,
          bankName,
          channel,
          sourceFileName: sourceFileName ?? null,
        },
      });

      const createdLines: Array<{ id: string }> = [];
      for (const r of rows) {
        const line = await tx.bankStatementLine.create({
          data: {
            organizationId,
            bankStatementId: stmt.id,
            description: r.description,
            amount: r.amount,
            type: r.type,
            origin: BankStatementLineOrigin.FILE_IMPORT,
            counterpartyTaxId: r.counterpartyTaxId,
            valueDate: r.valueDate,
            rawRow: r.raw as Prisma.InputJsonValue,
          },
        });
        createdLines.push({ id: line.id });
      }

      const out = await tx.bankStatement.findUniqueOrThrow({
        where: { id: stmt.id },
        include: { _count: { select: { lines: true } } },
      });
      return { out, createdLines };
    });
    for (const line of createdLines) {
      await this.autoMatchOutgoingForLine(organizationId, line.id);
    }
    return out;
  }

  /**
   * Сетка карточек: по одному счёту кассы (101*) и банка (221–224) — сальдо ОСВ (ТЗ §6).
   */
  async getAccountCards(organizationId: string, ledgerType: LedgerType) {
    const today = new Date().toISOString().slice(0, 10);
    const yearStart = `${new Date().getUTCFullYear()}-01-01`;
    const tb = await this.reporting.trialBalance(
      organizationId,
      yearStart,
      today,
      ledgerType,
    );

    const accounts = await this.prisma.account.findMany({
      where: { organizationId, ledgerType },
      select: {
        code: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
        currency: true,
      },
    });
    const byCode = new Map(accounts.map((a) => [a.code, a]));

    const accountsOut: Array<{
      segment: "CASH" | "BANK";
      accountCode: string;
      displayName: string;
      maskedNumber: string;
      balances: { currency: string; amount: string }[];
    }> = [];

    for (const row of tb.rows) {
      const seg = segmentForAccountCode(row.accountCode);
      if (!seg) continue;
      const acc = byCode.get(row.accountCode);
      const net = new Decimal(row.closingDebit).sub(
        new Decimal(row.closingCredit),
      );
      const cur = acc?.currency ?? "AZN";
      accountsOut.push({
        segment: seg,
        accountCode: row.accountCode,
        displayName: acc
          ? pickAccountDisplayName(acc, "az")
          : row.accountCode,
        maskedNumber: maskAccountCode(row.accountCode),
        balances: [{ currency: cur, amount: net.toFixed(2) }],
      });
    }

    return {
      dateFrom: tb.dateFrom,
      dateTo: tb.dateTo,
      ledgerType,
      accounts: accountsOut,
    };
  }

  async manualCashOut(
    organizationId: string,
    dto: { amount: number; description?: string; date?: string },
    role: UserRole,
  ) {
    assertMayPostManualJournal(role);
    const amt = new Decimal(dto.amount);
    if (amt.lte(0)) {
      throw new BadRequestException("amount must be positive");
    }
    let date: Date;
    try {
      date = dto.date?.trim()
        ? parseIsoDateOnly(dto.date.trim())
        : new Date();
    } catch {
      throw new BadRequestException("Invalid date (expected YYYY-MM-DD)");
    }
    const desc = dto.description?.trim() || "Nəqd məxaric";

    return this.prisma.$transaction(async (tx) => {
      await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date,
        reference: "CASH-OUT",
        description: desc,
        isFinal: true,
        lines: [
          {
            accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
            debit: amt.toString(),
            credit: 0,
          },
          {
            accountCode: CASH_OPERATIONAL_ACCOUNT_CODE,
            debit: 0,
            credit: amt.toString(),
          },
        ],
      });

      const stmt = await tx.bankStatement.create({
        data: {
          organizationId,
          date,
          totalAmount: amt,
          bankName: "MANUAL_CASH",
          channel: BankStatementChannel.CASH,
        },
      });

      await tx.bankStatementLine.create({
        data: {
          organizationId,
          bankStatementId: stmt.id,
          description: desc,
          amount: amt,
          type: BankStatementLineType.OUTFLOW,
          origin: BankStatementLineOrigin.MANUAL_CASH_OUT,
          valueDate: date,
        },
      });

      return { ok: true as const };
    });
  }

  /**
   * Ручная банковская операция: проводка + строка реестра (для отчётности и сверки).
   */
  async manualBankEntry(
    organizationId: string,
    dto: {
      type: BankStatementLineType;
      amount: number;
      bankAccountCode: string;
      offsetAccountCode: string;
      date: string;
      cashFlowItemId: string;
      description?: string;
    },
  ) {
    const bank = dto.bankAccountCode.trim();
    const offset = dto.offsetAccountCode.trim();
    if (!isBankLedgerAccountCode(bank)) {
      throw new BadRequestException(
        "bankAccountCode must be a bank account (221*, 222*, 223*, 224*)",
      );
    }
    if (!offset) {
      throw new BadRequestException("offsetAccountCode required");
    }
    await this.treasury.assertCashFlowItem(organizationId, dto.cashFlowItemId);

    const amt = new Decimal(dto.amount);
    if (amt.lte(0)) {
      throw new BadRequestException("amount must be positive");
    }
    let date: Date;
    try {
      date = parseIsoDateOnly(dto.date.trim());
    } catch {
      throw new BadRequestException("Invalid date (expected YYYY-MM-DD)");
    }
    const desc = dto.description?.trim() || "Manual bank entry";

    // Capital contribution policy:
    // - Bank contribution goes through manualBankEntry as Dr 221* / Cr 301.
    // - Cash contribution goes through KMO in CashOrderService as Dr 101* / Cr 301.
    if (offset === "301") {
      if (dto.type !== BankStatementLineType.INFLOW) {
        throw new BadRequestException(
          "Capital contribution to equity (301) must be INFLOW for bank entry (Dr 221* / Cr 301)",
        );
      }
      if (!(bank === "221" || bank.startsWith("221."))) {
        throw new BadRequestException(
          "Capital contribution to equity (301) must use settlement bank account 221*",
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const lines =
        dto.type === BankStatementLineType.INFLOW
          ? [
              { accountCode: bank, debit: amt.toString(), credit: "0" },
              { accountCode: offset, debit: "0", credit: amt.toString() },
            ]
          : [
              { accountCode: offset, debit: amt.toString(), credit: "0" },
              { accountCode: bank, debit: "0", credit: amt.toString() },
            ];

      await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date,
        reference: "BANK-MANUAL",
        description: desc,
        isFinal: true,
        lines,
      });

      const stmt = await tx.bankStatement.create({
        data: {
          organizationId,
          date,
          totalAmount: amt,
          bankName: "MANUAL_BANK",
          channel: BankStatementChannel.BANK,
        },
      });

      await tx.bankStatementLine.create({
        data: {
          organizationId,
          bankStatementId: stmt.id,
          description: desc,
          amount: amt,
          type: dto.type,
          origin: BankStatementLineOrigin.MANUAL_BANK_ENTRY,
          valueDate: date,
          isMatched: true,
          cashFlowItemId: dto.cashFlowItemId,
        },
      });

      return { ok: true as const, bankStatementId: stmt.id };
    });
  }

  async createInternalTransfer(
    organizationId: string,
    dto: CreateInternalTransferDto,
  ) {
    if (dto.sourceBankAccountId === dto.targetBankAccountId) {
      throw new BadRequestException("source and target accounts must differ");
    }
    const amount = new Decimal(dto.amount);
    const commission = new Decimal(dto.commissionAmount ?? 0);
    if (amount.lte(0)) {
      throw new BadRequestException("amount must be positive");
    }
    if (commission.lt(0)) {
      throw new BadRequestException("commissionAmount cannot be negative");
    }
    const date = parseIsoDateOnly(dto.date.trim());
    return this.prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.organizationBankAccount.findFirst({
          where: {
            id: dto.sourceBankAccountId,
            organizationId,
            isArchived: false,
          },
        }),
        tx.organizationBankAccount.findFirst({
          where: {
            id: dto.targetBankAccountId,
            organizationId,
            isArchived: false,
          },
        }),
      ]);
      if (!source || !target) {
        throw new BadRequestException("bank account not found in organization");
      }
      if (source.isFrozen) {
        throw new BadRequestException("frozen account cannot be used as transfer source");
      }
      if (source.currency !== target.currency) {
        throw new BadRequestException(
          "internal transfer requires same currency accounts",
        );
      }
      await this.assertNasAccountsExist(tx, organizationId, [
        source.ledgerAccountCode,
        target.ledgerAccountCode,
        TRANSIT_TRANSFER_ACCOUNT_CODE,
        MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
      ]);

      const transferTotal = amount.add(commission);
      const lines = [
        {
          accountCode: TRANSIT_TRANSFER_ACCOUNT_CODE,
          debit: transferTotal.toString(),
          credit: "0",
        },
        { accountCode: source.ledgerAccountCode, debit: "0", credit: transferTotal.toString() },
        ...(commission.gt(0)
          ? [
              {
                accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
                debit: commission.toString(),
                credit: "0",
              },
              {
                accountCode: TRANSIT_TRANSFER_ACCOUNT_CODE,
                debit: "0",
                credit: commission.toString(),
              },
            ]
          : []),
        { accountCode: target.ledgerAccountCode, debit: amount.toString(), credit: "0" },
        { accountCode: TRANSIT_TRANSFER_ACCOUNT_CODE, debit: "0", credit: amount.toString() },
      ];
      this.assertBalanced(lines);

      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date,
        reference: "BANK-INTERNAL-TRANSFER",
        description: `Internal transfer ${source.iban} -> ${target.iban}`,
        isFinal: true,
        lines,
      });

      const stmt = await tx.bankStatement.create({
        data: {
          organizationId,
          date,
          totalAmount: amount,
          bankName: "MANUAL_INTERNAL_TRANSFER",
          channel: BankStatementChannel.BANK,
        },
      });
      await tx.bankStatementLine.createMany({
        data: [
          {
            organizationId,
            bankStatementId: stmt.id,
            description: `Internal transfer out: ${source.bankName}`,
            amount: transferTotal,
            type: BankStatementLineType.OUTFLOW,
            origin: BankStatementLineOrigin.MANUAL_BANK_ENTRY,
            valueDate: date,
            isMatched: true,
            rawRow: {
              operation: "INTERNAL_TRANSFER",
              role: "source",
              sourceBankAccountId: source.id,
              targetBankAccountId: target.id,
              commission: commission.toString(),
              transactionId,
            } as Prisma.InputJsonValue,
          },
          {
            organizationId,
            bankStatementId: stmt.id,
            description: `Internal transfer in: ${target.bankName}`,
            amount,
            type: BankStatementLineType.INFLOW,
            origin: BankStatementLineOrigin.MANUAL_BANK_ENTRY,
            valueDate: date,
            isMatched: true,
            rawRow: {
              operation: "INTERNAL_TRANSFER",
              role: "target",
              sourceBankAccountId: source.id,
              targetBankAccountId: target.id,
              commission: commission.toString(),
              transactionId,
            } as Prisma.InputJsonValue,
          },
        ],
      });
      return { ok: true as const, transactionId, bankStatementId: stmt.id };
    });
  }

  listOrganizationBankAccounts(organizationId: string) {
    return this.prisma.organizationBankAccount.findMany({
      where: { organizationId, isArchived: false },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        bankName: true,
        iban: true,
        swift: true,
        currency: true,
        ledgerAccountCode: true,
        accountType: true,
        isPrimary: true,
        isFrozen: true,
      },
    });
  }

  async createOrganizationBankAccount(
    organizationId: string,
    dto: CreateOrganizationBankAccountDto,
  ) {
    const explicitCode = dto.ledgerAccountCode?.trim() ?? "";
    const branchId = dto.bankBranchId?.trim() || null;
    if (!explicitCode && !branchId) {
      throw new BadRequestException(
        "Either ledgerAccountCode or bankBranchId must be provided",
      );
    }
    if (explicitCode && !/^(221|222|223|224|225)(\.\d{2}){0,4}$/.test(explicitCode)) {
      throw new BadRequestException(
        "ledgerAccountCode must start with 221/222/223/224/225",
      );
    }
    const iban = dto.iban.trim().replace(/\s+/g, "").toUpperCase();
    const currency = (dto.currency ?? "AZN").toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      // Resolve ledger code: either explicit or auto-generated from BankBranch.
      let code = explicitCode;
      if (!code && branchId) {
        const sub = await this.bankSubaccount.ensureSubaccountForBranch(
          organizationId,
          branchId,
          { currency, nameOverride: dto.bankName.trim() || undefined },
          tx,
        );
        code = sub.code;
      } else if (code) {
        const hasCode = await tx.account.findFirst({
          where: { organizationId, ledgerType: LedgerType.NAS, code },
          select: { id: true },
        });
        if (!hasCode) {
          throw new BadRequestException(`NAS account not found: ${code}`);
        }
      }

      if (dto.isPrimary === true) {
        await tx.organizationBankAccount.updateMany({
          where: { organizationId, isArchived: false },
          data: { isPrimary: false },
        });
      }
      return tx.organizationBankAccount.create({
        data: {
          organizationId,
          bankName: dto.bankName.trim(),
          iban,
          accountNumber: iban,
          swift: dto.swift?.trim() || null,
          currency,
          ledgerAccountCode: code,
          accountType: (dto.accountType as any) ?? "MAIN",
          isPrimary: dto.isPrimary === true,
          isFrozen: dto.isFrozen === true,
          isArchived: false,
          bankBranchId: branchId,
        },
      });
    });
  }

  async updateOrganizationBankAccount(
    organizationId: string,
    id: string,
    dto: UpdateOrganizationBankAccountDto,
  ) {
    const existing = await this.prisma.organizationBankAccount.findFirst({
      where: { id, organizationId, isArchived: false },
      select: {
        id: true,
        bankBranchId: true,
        ledgerAccountCode: true,
        currency: true,
        bankName: true,
      },
    });
    if (!existing) throw new BadRequestException("bank account not found");

    if (dto.ledgerAccountCode) {
      const code = dto.ledgerAccountCode.trim();
      if (!/^(221|222|223|224|225)(\.\d{2}){0,4}$/.test(code)) {
        throw new BadRequestException(
          "ledgerAccountCode must start with 221/222/223/224/225",
        );
      }
      const hasCode = await this.prisma.account.findFirst({
        where: { organizationId, ledgerType: LedgerType.NAS, code },
        select: { id: true },
      });
      if (!hasCode) {
        throw new BadRequestException(`NAS account not found: ${code}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // If bankBranchId is being attached for the first time and there is no
      // explicit ledgerAccountCode override, auto-generate the 221.<code>.<seq>
      // subaccount via the AccountingService hook (TZ §6.0).
      let autoLedgerCode: string | null = null;
      const incomingBranchId =
        dto.bankBranchId !== undefined ? dto.bankBranchId?.trim() || null : undefined;
      if (
        incomingBranchId !== undefined &&
        incomingBranchId !== existing.bankBranchId &&
        incomingBranchId !== null &&
        !dto.ledgerAccountCode
      ) {
        const sub = await this.bankSubaccount.ensureSubaccountForBranch(
          organizationId,
          incomingBranchId,
          {
            currency: (dto.currency ?? existing.currency).toUpperCase(),
            nameOverride:
              dto.bankName?.trim() || existing.bankName || undefined,
          },
          tx,
        );
        autoLedgerCode = sub.code;
      }

      const data: Prisma.OrganizationBankAccountUpdateInput = {};
      if (dto.bankName !== undefined) data.bankName = dto.bankName.trim();
      if (dto.iban !== undefined) {
        const iban = dto.iban.trim().replace(/\s+/g, "").toUpperCase();
        data.iban = iban;
        data.accountNumber = iban;
      }
      if (dto.swift !== undefined) data.swift = dto.swift?.trim() || null;
      if (dto.currency !== undefined) {
        data.currencyRef = {
          connect: { code: dto.currency.toUpperCase() },
        };
      }
      if (dto.ledgerAccountCode !== undefined) {
        data.ledgerAccountCode = dto.ledgerAccountCode.trim();
      } else if (autoLedgerCode) {
        data.ledgerAccountCode = autoLedgerCode;
      }
      if (dto.accountType !== undefined) data.accountType = dto.accountType as any;
      if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;
      if (dto.isFrozen !== undefined) data.isFrozen = dto.isFrozen;
      if (incomingBranchId !== undefined) {
        data.bankBranch = incomingBranchId
          ? { connect: { id: incomingBranchId } }
          : { disconnect: true };
      }

      if (dto.isPrimary === true) {
        await tx.organizationBankAccount.updateMany({
          where: { organizationId, isArchived: false },
          data: { isPrimary: false },
        });
      }
      return tx.organizationBankAccount.update({
        where: { id },
        data,
      });
    });
  }

  async deleteOrganizationBankAccount(organizationId: string, id: string) {
    const row = await this.prisma.organizationBankAccount.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!row) throw new BadRequestException("bank account not found");

    const linkedSalaryRegs = await this.prisma.salaryRegistry.count({
      where: { organizationId, bankAccountId: id },
    });
    if (linkedSalaryRegs > 0) {
      await this.prisma.organizationBankAccount.update({
        where: { id },
        data: { isArchived: true, isPrimary: false },
      });
      return { archived: true };
    }
    await this.prisma.organizationBankAccount.delete({ where: { id } });
    return { deleted: true };
  }

  async createBankConversion(
    organizationId: string,
    dto: CreateBankConversionDto,
  ) {
    if (dto.sourceBankAccountId === dto.targetBankAccountId) {
      throw new BadRequestException("source and target accounts must differ");
    }
    const sourceAmount = new Decimal(dto.sourceAmount);
    const targetAmount = new Decimal(dto.targetAmount);
    const commission = new Decimal(dto.commissionAmount ?? 0);
    if (sourceAmount.lte(0) || targetAmount.lte(0)) {
      throw new BadRequestException("sourceAmount and targetAmount must be positive");
    }
    if (commission.lt(0)) {
      throw new BadRequestException("commissionAmount cannot be negative");
    }
    const date = parseIsoDateOnly(dto.date.trim());

    return this.prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.organizationBankAccount.findFirst({
          where: {
            id: dto.sourceBankAccountId,
            organizationId,
            isArchived: false,
          },
        }),
        tx.organizationBankAccount.findFirst({
          where: {
            id: dto.targetBankAccountId,
            organizationId,
            isArchived: false,
          },
        }),
      ]);
      if (!source || !target) {
        throw new BadRequestException("bank account not found in organization");
      }
      if (source.isFrozen) {
        throw new BadRequestException("frozen account cannot be used as conversion source");
      }
      if (source.currency === target.currency) {
        throw new BadRequestException(
          "conversion requires different source and target currencies",
        );
      }
      await this.assertNasAccountsExist(tx, organizationId, [
        source.ledgerAccountCode,
        target.ledgerAccountCode,
        FX_GAIN_ACCOUNT_CODE,
        FX_LOSS_ACCOUNT_CODE,
        MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
      ]);

      const sourceRate = await this.getOfficialRate(tx, date, source.currency);
      const targetRate = await this.getOfficialRate(tx, date, target.currency);

      // Convert target amount into source currency through AZN cross-rate.
      const officialTargetInSource = targetAmount
        .mul(targetRate)
        .div(sourceRate)
        .toDecimalPlaces(4);

      const fxDelta = sourceAmount.sub(officialTargetInSource).toDecimalPlaces(4);
      const isLoss = fxDelta.gt(0);
      const fxAbs = fxDelta.abs();

      const lines: Array<{ accountCode: string; debit: string; credit: string }> = [
        {
          accountCode: target.ledgerAccountCode,
          debit: officialTargetInSource.toString(),
          credit: "0",
        },
        {
          accountCode: source.ledgerAccountCode,
          debit: "0",
          credit: sourceAmount.toString(),
        },
      ];
      if (fxAbs.gt(0)) {
        if (isLoss) {
          lines.push({
            accountCode: FX_LOSS_ACCOUNT_CODE,
            debit: fxAbs.toString(),
            credit: "0",
          });
        } else {
          lines.push({
            accountCode: FX_GAIN_ACCOUNT_CODE,
            debit: "0",
            credit: fxAbs.toString(),
          });
        }
      }
      if (commission.gt(0)) {
        lines.push({
          accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
          debit: commission.toString(),
          credit: "0",
        });
        lines.push({
          accountCode: source.ledgerAccountCode,
          debit: "0",
          credit: commission.toString(),
        });
      }
      this.assertBalanced(lines);

      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date,
        reference: "BANK-CONVERSION",
        description: `Conversion ${source.currency}->${target.currency}`,
        isFinal: true,
        lines,
      });

      const stmt = await tx.bankStatement.create({
        data: {
          organizationId,
          date,
          totalAmount: sourceAmount,
          bankName: "MANUAL_CONVERSION",
          channel: BankStatementChannel.BANK,
        },
      });
      await tx.bankStatementLine.createMany({
        data: [
          {
            organizationId,
            bankStatementId: stmt.id,
            description: `Conversion out ${source.currency}`,
            amount: sourceAmount.add(commission),
            type: BankStatementLineType.OUTFLOW,
            origin: BankStatementLineOrigin.MANUAL_BANK_ENTRY,
            valueDate: date,
            isMatched: true,
            rawRow: {
              operation: "CONVERSION",
              role: "source",
              sourceBankAccountId: source.id,
              targetBankAccountId: target.id,
              sourceAmount: sourceAmount.toString(),
              targetAmount: targetAmount.toString(),
              commission: commission.toString(),
              sourceRate: sourceRate.toString(),
              targetRate: targetRate.toString(),
              officialTargetInSource: officialTargetInSource.toString(),
              fxDelta: fxDelta.toString(),
              transactionId,
            } as Prisma.InputJsonValue,
          },
          {
            organizationId,
            bankStatementId: stmt.id,
            description: `Conversion in ${target.currency}`,
            amount: targetAmount,
            type: BankStatementLineType.INFLOW,
            origin: BankStatementLineOrigin.MANUAL_BANK_ENTRY,
            valueDate: date,
            isMatched: true,
            rawRow: {
              operation: "CONVERSION",
              role: "target",
              sourceBankAccountId: source.id,
              targetBankAccountId: target.id,
              sourceAmount: sourceAmount.toString(),
              targetAmount: targetAmount.toString(),
              commission: commission.toString(),
              sourceRate: sourceRate.toString(),
              targetRate: targetRate.toString(),
              officialTargetInSource: officialTargetInSource.toString(),
              fxDelta: fxDelta.toString(),
              transactionId,
            } as Prisma.InputJsonValue,
          },
        ],
      });

      return {
        ok: true as const,
        transactionId,
        bankStatementId: stmt.id,
        fxDelta: fxDelta.toString(),
        officialTargetInSource: officialTargetInSource.toString(),
      };
    });
  }

  async createCashDeposit(organizationId: string, dto: CreateCashDepositDto) {
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException("amount must be positive");
    }
    const date = parseIsoDateOnly(dto.date.trim());
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.organizationBankAccount.findFirst({
        where: {
          id: dto.targetBankAccountId,
          organizationId,
          isArchived: false,
        },
      });
      if (!target) {
        throw new BadRequestException("target bank account not found in organization");
      }
      const sourceAccountCode =
        dto.source === "KASSA" ? CASH_IN_TRANSIT_ACCOUNT_CODE : FOUNDER_FUNDS_ACCOUNT_CODE;

      await this.assertNasAccountsExist(tx, organizationId, [
        target.ledgerAccountCode,
        sourceAccountCode,
      ]);

      const lines = [
        {
          accountCode: target.ledgerAccountCode,
          debit: amount.toString(),
          credit: "0",
        },
        {
          accountCode: sourceAccountCode,
          debit: "0",
          credit: amount.toString(),
        },
      ];
      this.assertBalanced(lines);

      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date,
        reference: "BANK-CASH-DEPOSIT",
        description:
          dto.description?.trim() ||
          `Cash deposit to ${target.bankName} (${dto.source})`,
        isFinal: true,
        lines,
      });

      const stmt = await tx.bankStatement.create({
        data: {
          organizationId,
          date,
          totalAmount: amount,
          bankName: "MANUAL_CASH_DEPOSIT",
          channel: BankStatementChannel.BANK,
        },
      });
      await tx.bankStatementLine.create({
        data: {
          organizationId,
          bankStatementId: stmt.id,
          description:
            dto.description?.trim() ||
            `Cash deposit (${dto.source}) to ${target.currency} account`,
          amount,
          type: BankStatementLineType.INFLOW,
          origin: BankStatementLineOrigin.MANUAL_BANK_ENTRY,
          valueDate: date,
          isMatched: true,
          rawRow: {
            operation: "CASH_DEPOSIT",
            source: dto.source,
            targetBankAccountId: target.id,
            transactionId,
          } as Prisma.InputJsonValue,
        },
      });
      return { ok: true as const, transactionId, bankStatementId: stmt.id };
    });
  }

  private assertBalanced(
    lines: Array<{ accountCode: string; debit: string; credit: string }>,
  ): void {
    let debit = new Decimal(0);
    let credit = new Decimal(0);
    for (const l of lines) {
      debit = debit.add(new Decimal(l.debit));
      credit = credit.add(new Decimal(l.credit));
    }
    if (!debit.equals(credit)) {
      throw new BadRequestException(
        `journal is not balanced (debit=${debit.toString()}, credit=${credit.toString()})`,
      );
    }
  }

  private async getOfficialRate(
    tx: Prisma.TransactionClient,
    date: Date,
    currency: string,
  ): Promise<Decimal> {
    const c = currency.trim().toUpperCase();
    if (c === "AZN") return new Decimal(1);
    const row = await tx.cbarOfficialRate.findUnique({
      where: {
        rateDate_currencyCode: { rateDate: date, currencyCode: c },
      },
      select: { rate: true },
    });
    if (!row) {
      throw new BadRequestException(`CBAR rate not found for ${c} on selected date`);
    }
    return row.rate;
  }

  private async assertNasAccountsExist(
    tx: Prisma.TransactionClient,
    organizationId: string,
    accountCodes: string[],
  ): Promise<void> {
    const uniqueCodes = [...new Set(accountCodes.map((x) => x.trim()))];
    const rows = await tx.account.findMany({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code: { in: uniqueCodes },
      },
      select: { code: true },
    });
    const found = new Set(rows.map((x) => x.code));
    const missing = uniqueCodes.filter((x) => !found.has(x));
    if (missing.length > 0) {
      throw new BadRequestException(
        `NAS accounts not found: ${missing.join(", ")}`,
      );
    }
  }

  listStatements(organizationId: string) {
    return this.prisma.bankStatement.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { lines: true } } },
    });
  }

  listLines(
    organizationId: string,
    filters?: {
      bankStatementId?: string;
      unmatchedOnly?: boolean;
      needsAttention?: boolean;
      /** BANK | CASH — фильтр по каналу выписки */
      channel?: "BANK" | "CASH";
      /**
       * Жёсткий серверный фильтр только по банковским origins:
       * MANUAL_BANK_ENTRY, FILE_IMPORT, DIRECT_SYNC
       */
      bankOnly?: boolean;
      /** YYYY-MM-DD (UTC-день), включительно */
      valueDateFrom?: string;
      /** YYYY-MM-DD (UTC-день), включительно до конца дня */
      valueDateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const channelFilter =
      filters?.channel === "BANK"
        ? { bankStatement: { channel: BankStatementChannel.BANK } }
        : filters?.channel === "CASH"
          ? { bankStatement: { channel: BankStatementChannel.CASH } }
          : {};

    const originFilter = filters?.bankOnly
      ? {
          origin: {
            in: [
              BankStatementLineOrigin.MANUAL_BANK_ENTRY,
              BankStatementLineOrigin.FILE_IMPORT,
              BankStatementLineOrigin.DIRECT_SYNC,
            ],
          },
        }
      : {};

    const valueDateRange =
      filters?.valueDateFrom || filters?.valueDateTo
        ? {
            valueDate: {
              not: null,
              ...(filters.valueDateFrom
                ? { gte: parseIsoDateOnly(filters.valueDateFrom) }
                : {}),
              ...(filters.valueDateTo
                ? { lte: endOfUtcDay(parseIsoDateOnly(filters.valueDateTo)) }
                : {}),
            },
          }
        : {};

    const where = {
      organizationId,
      ...channelFilter,
      ...originFilter,
      ...valueDateRange,
      ...(filters?.bankStatementId
        ? { bankStatementId: filters.bankStatementId }
        : {}),
      ...(filters?.needsAttention
        ? { isMatched: false, type: BankStatementLineType.INFLOW }
        : filters?.unmatchedOnly
          ? { isMatched: false }
          : {}),
    };

    const page = Math.max(1, Math.trunc(filters?.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Math.trunc(filters?.pageSize ?? 25)));
    const skip = (page - 1) * pageSize;

    const orderBy = [{ valueDate: "desc" as const }, { createdAt: "desc" as const }];
    const include = {
      bankStatement: {
        select: {
          id: true,
          bankName: true,
          date: true,
          channel: true,
        },
      },
      matchedInvoice: {
        select: { id: true, number: true, status: true, totalAmount: true },
      },
    };

    return Promise.all([
      this.prisma.bankStatementLine.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include,
      }),
      this.prisma.bankStatementLine.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      pageSize,
    }));
  }

  listPaymentDrafts(organizationId: string, status?: "PENDING" | "SENT" | "REJECTED" | "COMPLETED") {
    return (this.prisma as any).bankPaymentDraft.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  private async autoMatchOutgoingForLine(
    organizationId: string,
    lineId: string,
  ): Promise<void> {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, organizationId },
      select: { id: true, isMatched: true, type: true, amount: true },
    });
    if (!line || line.isMatched || line.type !== BankStatementLineType.OUTFLOW) {
      return;
    }
    const amount = new Decimal(line.amount);

    const sentDrafts = await (this.prisma as any).bankPaymentDraft.findMany({
      where: { organizationId, status: "SENT" },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    const draftMatch = sentDrafts.filter((d: { amount: unknown }) =>
      new Decimal(d.amount).equals(amount),
    );
    if (draftMatch.length === 1) {
      await this.prisma.$transaction(async (tx) => {
        await (tx as any).bankPaymentDraft.update({
          where: { id: draftMatch[0].id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        await tx.bankStatementLine.update({
          where: { id: line.id },
          data: { isMatched: true },
        });
      });
      return;
    }

    const sentRegistries = await (this.prisma as any).salaryRegistry.findMany({
      where: { organizationId, status: "SENT" },
      include: { payrollRun: { include: { slips: { select: { net: true } } } } },
      take: 100,
    });
    const salaryMatch = sentRegistries.filter((r: { payrollRun?: { slips?: Array<{ net: unknown }> } }) => {
      const total = (r.payrollRun?.slips ?? []).reduce(
        (sum, s) => sum.add(new Decimal(s.net)),
        new Decimal(0),
      );
      return total.equals(amount);
    });
    if (salaryMatch.length === 1) {
      await this.prisma.$transaction(async (tx) => {
        await (tx as any).salaryRegistry.update({
          where: { id: salaryMatch[0].id },
          data: { status: "PAID" },
        });
        await tx.bankStatementLine.update({
          where: { id: line.id },
          data: { isMatched: true },
        });
      });
    }
  }
}
