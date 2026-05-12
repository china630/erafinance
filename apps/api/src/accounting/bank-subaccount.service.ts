import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccountType, LedgerType, Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

/** Mask root for bank subaccounts in the NAS chart of accounts (PRD §4.6). */
export const BANK_SUBACCOUNT_PARENT_CODE = "221";
export const BANK_SUBACCOUNT_BANK_CODE_RE = /^[0-9]{2}$/;
const SEQUENCE_MAX = 99;

export type AccountingDb = PrismaService | Prisma.TransactionClient;

export interface EnsureBankSubaccountOptions {
  /** ISO currency for the subaccount (default `AZN`). */
  currency?: string;
  /** Override display name; defaults to `<BankNameAz> — <BranchName>`. */
  nameOverride?: string;
}

export interface BankSubaccountResult {
  id: string;
  code: string;
  nameAz: string;
  currency: string;
  /** True when row was created in this call; false if it already existed. */
  created: boolean;
}

/**
 * AccountingService hook that materializes a NAS subaccount of `221` per
 * organization × bank branch.
 *
 * Mask: `221.<BankCode>.<Sequence>` where `BankCode` is the two-digit code
 * from `BankGlossary.code` and `Sequence` is a two-digit, organization-local,
 * monotonically increasing counter (`01`, `02`, …, max `99`).
 *
 * Idempotent w.r.t. (organizationId, bankBranchId, currency): if a subaccount
 * already exists for that triple, it is returned as-is.
 */
@Injectable()
export class BankSubaccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute the next subaccount code for an organization × bank code. Scans
   * existing NAS accounts under `221.<bankCode>.` and picks `max + 1`.
   */
  async nextSubaccountCode(
    organizationId: string,
    bankCode: string,
    db: AccountingDb = this.prisma,
  ): Promise<string> {
    if (!BANK_SUBACCOUNT_BANK_CODE_RE.test(bankCode)) {
      throw new BadRequestException(
        `Bank code must be 2 digits (got "${bankCode}")`,
      );
    }
    const prefix = `${BANK_SUBACCOUNT_PARENT_CODE}.${bankCode}.`;
    const rows = await db.account.findMany({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code: { startsWith: prefix },
      },
      select: { code: true },
    });
    let max = 0;
    for (const r of rows) {
      const tail = r.code.slice(prefix.length);
      // First two digits of the tail are the sequence; allow nested levels
      // (e.g. `221.14.03.01`) to coexist without breaking enumeration.
      const m = /^(\d{2})/.exec(tail);
      if (!m) continue;
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    const next = max + 1;
    if (next > SEQUENCE_MAX) {
      throw new BadRequestException(
        `Bank subaccount sequence overflow for ${prefix}* (max ${SEQUENCE_MAX})`,
      );
    }
    return `${prefix}${String(next).padStart(2, "0")}`;
  }

  /**
   * Ensure a NAS subaccount `221.<bankCode>.<seq>` exists for the given
   * organization × bank branch. Returns the existing row if a previous
   * call has already created one.
   *
   * Caller is expected to attach the returned `code` to
   * `OrganizationBankAccount.ledgerAccountCode`.
   */
  async ensureSubaccountForBranch(
    organizationId: string,
    bankBranchId: string,
    options: EnsureBankSubaccountOptions = {},
    db: AccountingDb = this.prisma,
  ): Promise<BankSubaccountResult> {
    const branch = await db.bankBranch.findUnique({
      where: { id: bankBranchId },
      include: { bank: true },
    });
    if (!branch) {
      throw new NotFoundException(`Bank branch ${bankBranchId} not found`);
    }
    if (!branch.isActive || !branch.bank.isActive) {
      throw new BadRequestException(
        `Bank branch ${branch.bank.nameAz} (${branch.name}) is inactive`,
      );
    }
    if (!BANK_SUBACCOUNT_BANK_CODE_RE.test(branch.bank.code)) {
      throw new BadRequestException(
        `Bank glossary entry has invalid 2-digit code "${branch.bank.code}"`,
      );
    }

    const currency = (options.currency ?? "AZN").toUpperCase();
    const baseName =
      options.nameOverride?.trim() ||
      `${branch.bank.nameAz} — ${branch.name}`;

    // Check for an already-linked subaccount via existing organization bank
    // accounts pointing to this branch (idempotent path on retries).
    const linked = await db.organizationBankAccount.findFirst({
      where: {
        organizationId,
        bankBranchId,
        currency,
        isArchived: false,
      },
      select: { ledgerAccountCode: true },
    });
    if (linked?.ledgerAccountCode) {
      const existing = await db.account.findFirst({
        where: {
          organizationId,
          ledgerType: LedgerType.NAS,
          code: linked.ledgerAccountCode,
        },
        select: { id: true, code: true, nameAz: true, currency: true },
      });
      if (existing) {
        return { ...existing, created: false };
      }
    }

    const parent = await db.account.findFirst({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code: BANK_SUBACCOUNT_PARENT_CODE,
      },
      select: { id: true },
    });
    if (!parent) {
      throw new NotFoundException(
        `Parent NAS account ${BANK_SUBACCOUNT_PARENT_CODE} not found in organization`,
      );
    }

    const code = await this.nextSubaccountCode(
      organizationId,
      branch.bank.code,
      db,
    );

    const created = await db.account.create({
      data: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code,
        nameAz: baseName,
        nameRu: baseName,
        nameEn: baseName,
        type: AccountType.ASSET,
        currency,
        parentId: parent.id,
      },
      select: { id: true, code: true, nameAz: true, currency: true },
    });
    return { ...created, created: true };
  }
}
