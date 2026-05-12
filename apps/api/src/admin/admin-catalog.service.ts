import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CounterpartyLegalForm,
  OrganizationKind,
  Prisma,
  StockMovementReason,
  StockMovementType,
  UserRole,
  cashProfileForNasCode,
  legalFormToOrganizationKind,
  TaxRateKind,
} from "@erafinance/database";
import {
  ORGANIZATION_BANK_ACCOUNT_CURRENCIES,
  ORGANIZATION_BANK_ACCOUNT_TYPES,
} from "@erafinance/api-contracts";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCurrencyDto, PatchCurrencyDto } from "./dto/admin-currency.dto";
import type {
  CreateTaxRateDto,
  PatchTaxRateDto,
} from "./dto/admin-tax-rate.dto";
import type {
  CreateUnitOfMeasureDto,
  PatchUnitOfMeasureDto,
} from "./dto/admin-unit-of-measure.dto";
import type {
  PatchTemplateAccountDto,
  UpsertTemplateAccountDto,
} from "./dto/admin-template-account.dto";

function sumRelationCounts(
  count: Record<string, number> | undefined,
): number {
  if (!count) return 0;
  return Object.values(count).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
}

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCurrencies() {
    const rows = await this.prisma.currency.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: {
        _count: {
          select: {
            organizations: true,
            organizationBankAccounts: true,
            paymentOrders: true,
            bankPaymentDrafts: true,
            approvalPolicies: true,
            prepaidExpenses: true,
            psaProjects: true,
            accounts: true,
            counterpartyBankAccounts: true,
            invoices: true,
            customsDeclarations: true,
            cashOrders: true,
            holdings: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      ...r,
      usageTotal: sumRelationCounts(r._count as Record<string, number>),
      _count: undefined,
    }));
  }

  async createCurrency(dto: CreateCurrencyDto) {
    const code = dto.code.trim().toUpperCase();
    return this.prisma.currency.create({
      data: {
        code,
        symbol: dto.symbol.trim(),
        decimals: dto.decimals ?? 2,
        nameAz: dto.nameAz.trim(),
        nameRu: dto.nameRu.trim(),
        nameEn: dto.nameEn.trim(),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async patchCurrency(id: string, dto: PatchCurrencyDto) {
    try {
      return await this.prisma.currency.update({
        where: { id },
        data: {
          ...(dto.symbol !== undefined ? { symbol: dto.symbol.trim() } : {}),
          ...(dto.decimals !== undefined ? { decimals: dto.decimals } : {}),
          ...(dto.nameAz !== undefined ? { nameAz: dto.nameAz.trim() } : {}),
          ...(dto.nameRu !== undefined ? { nameRu: dto.nameRu.trim() } : {}),
          ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn.trim() } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    } catch {
      throw new NotFoundException("Currency not found");
    }
  }

  async listUnitsOfMeasure() {
    const rows = await this.prisma.unitOfMeasure.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: {
        _count: {
          select: {
            products: true,
            invoiceItems: true,
            inventoryAuditLines: true,
            customsDeclarationItems: true,
            systemProductTemplates: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      ...r,
      usageTotal: sumRelationCounts(r._count as Record<string, number>),
      _count: undefined,
    }));
  }

  async createUnitOfMeasure(dto: CreateUnitOfMeasureDto) {
    const code = dto.code.trim().toUpperCase();
    const factor = new Prisma.Decimal(dto.factor ?? 1);
    return this.prisma.unitOfMeasure.create({
      data: {
        code,
        kind: dto.kind,
        baseCode: dto.baseCode?.trim() || null,
        factor,
        nameAz: dto.nameAz.trim(),
        nameRu: dto.nameRu.trim(),
        nameEn: dto.nameEn.trim(),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async patchUnitOfMeasure(id: string, dto: PatchUnitOfMeasureDto) {
    try {
      return await this.prisma.unitOfMeasure.update({
        where: { id },
        data: {
          ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
          ...(dto.baseCode !== undefined
            ? { baseCode: dto.baseCode?.trim() || null }
            : {}),
          ...(dto.factor !== undefined
            ? { factor: new Prisma.Decimal(dto.factor) }
            : {}),
          ...(dto.nameAz !== undefined ? { nameAz: dto.nameAz.trim() } : {}),
          ...(dto.nameRu !== undefined ? { nameRu: dto.nameRu.trim() } : {}),
          ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn.trim() } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    } catch {
      throw new NotFoundException("Unit of measure not found");
    }
  }

  async listTaxRates() {
    const rows = await this.prisma.taxRate.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      include: {
        _count: { select: { systemProducts: true } },
      },
    });
    return rows.map((r) => ({
      ...r,
      usageTotal: r._count.systemProducts,
      _count: undefined,
    }));
  }

  async createTaxRate(dto: CreateTaxRateDto) {
    const code = dto.code.trim().toUpperCase();
    const effectiveFrom = new Date(`${dto.effectiveFrom.slice(0, 10)}T00:00:00.000Z`);
    const effectiveTo =
      dto.effectiveTo != null && dto.effectiveTo !== ""
        ? new Date(`${dto.effectiveTo.slice(0, 10)}T00:00:00.000Z`)
        : null;
    return this.prisma.taxRate.create({
      data: {
        code,
        kind: dto.kind,
        region: (dto.region ?? "AZ").trim().toUpperCase(),
        percent: new Prisma.Decimal(dto.percent),
        effectiveFrom,
        effectiveTo,
        nameAz: dto.nameAz.trim(),
        nameRu: dto.nameRu.trim(),
        nameEn: dto.nameEn.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async patchTaxRate(id: string, dto: PatchTaxRateDto) {
    try {
      const data: Prisma.TaxRateUpdateInput = {};
      if (dto.kind !== undefined) data.kind = dto.kind;
      if (dto.region !== undefined) data.region = dto.region.trim().toUpperCase();
      if (dto.percent !== undefined) data.percent = new Prisma.Decimal(dto.percent);
      if (dto.effectiveFrom !== undefined) {
        data.effectiveFrom = new Date(`${dto.effectiveFrom.slice(0, 10)}T00:00:00.000Z`);
      }
      if (dto.effectiveTo !== undefined) {
        data.effectiveTo =
          dto.effectiveTo != null && dto.effectiveTo !== ""
            ? new Date(`${dto.effectiveTo.slice(0, 10)}T00:00:00.000Z`)
            : null;
      }
      if (dto.nameAz !== undefined) data.nameAz = dto.nameAz.trim();
      if (dto.nameRu !== undefined) data.nameRu = dto.nameRu.trim();
      if (dto.nameEn !== undefined) data.nameEn = dto.nameEn.trim();
      if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      return await this.prisma.taxRate.update({
        where: { id },
        data,
      });
    } catch {
      throw new NotFoundException("Tax rate not found");
    }
  }

  async listTemplateAccounts() {
    const rows = await this.prisma.templateAccount.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      include: {
        _count: { select: { accounts: true } },
      },
    });
    return rows.map((r) => ({
      ...r,
      usageTotal: r._count.accounts,
      _count: undefined,
    }));
  }

  async upsertTemplateAccount(dto: UpsertTemplateAccountDto) {
    const kind = dto.kind ?? OrganizationKind.COMMERCIAL;
    const code = dto.code.trim();
    const parentRaw = dto.parentCode?.trim();
    const parentCode =
      parentRaw && parentRaw.length > 0 ? parentRaw : null;
    if (parentCode === code) {
      throw new BadRequestException("parentCode cannot equal code");
    }
    if (parentCode) {
      const parent = await this.prisma.templateAccount.findFirst({
        where: { kind, code: parentCode },
      });
      if (!parent) {
        throw new BadRequestException(`Unknown parentCode in ${kind}: ${parentCode}`);
      }
    }
    let cashProfile = dto.cashProfile?.trim() || null;
    if (!cashProfile) {
      cashProfile = cashProfileForNasCode(kind, code);
    }
    const sortOrder = dto.sortOrder ?? 0;
    const isDeprecated = dto.isDeprecated ?? false;
    return this.prisma.templateAccount.upsert({
      where: { kind_code: { kind, code } },
      create: {
        kind,
        code,
        nameAz: dto.nameAz.trim(),
        nameRu: dto.nameRu.trim(),
        nameEn: dto.nameEn.trim(),
        accountType: dto.accountType,
        parentCode,
        cashProfile,
        sortOrder,
        isDeprecated,
      },
      update: {
        nameAz: dto.nameAz.trim(),
        nameRu: dto.nameRu.trim(),
        nameEn: dto.nameEn.trim(),
        accountType: dto.accountType,
        parentCode,
        cashProfile,
        sortOrder,
        isDeprecated,
      },
    });
  }

  async patchTemplateAccount(id: string, dto: PatchTemplateAccountDto) {
    const row = await this.prisma.templateAccount.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Template account not found");

    const kind = row.kind;
    const code = row.code;
    let parentCode =
      dto.parentCode !== undefined
        ? dto.parentCode?.trim() || null
        : row.parentCode;
    if (parentCode === code) {
      throw new BadRequestException("parentCode cannot equal code");
    }
    if (parentCode) {
      const parent = await this.prisma.templateAccount.findFirst({
        where: { kind, code: parentCode },
      });
      if (!parent) {
        throw new BadRequestException(`Unknown parentCode in ${kind}: ${parentCode}`);
      }
    }
    let cashProfile =
      dto.cashProfile !== undefined
        ? dto.cashProfile?.trim() || null
        : row.cashProfile;
    if (!cashProfile) {
      cashProfile = cashProfileForNasCode(kind, code);
    }

    return this.prisma.templateAccount.update({
      where: { id },
      data: {
        ...(dto.nameAz !== undefined ? { nameAz: dto.nameAz.trim() } : {}),
        ...(dto.nameRu !== undefined ? { nameRu: dto.nameRu.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn.trim() } : {}),
        ...(dto.accountType !== undefined ? { accountType: dto.accountType } : {}),
        ...(dto.parentCode !== undefined ? { parentCode } : {}),
        ...(dto.cashProfile !== undefined || cashProfile !== row.cashProfile
          ? { cashProfile }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isDeprecated !== undefined ? { isDeprecated: dto.isDeprecated } : {}),
      },
    });
  }

  async listGlobalCompanies(q: string | undefined, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const trimmed = q?.trim();
    const where: Prisma.GlobalCompanyDirectoryWhereInput = trimmed
      ? {
          OR: [
            { taxId: { contains: trimmed } },
            { name: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.globalCompanyDirectory.count({ where }),
      this.prisma.globalCompanyDirectory.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async listGlobalCounterparties(q: string | undefined, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const trimmed = q?.trim();
    const where: Prisma.GlobalCounterpartyWhereInput = trimmed
      ? {
          OR: [
            { taxId: { contains: trimmed } },
            { name: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.globalCounterparty.count({ where }),
      this.prisma.globalCounterparty.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  getReferenceSnapshot() {
    const legalFormMap: Record<string, string> = {};
    for (const f of Object.values(CounterpartyLegalForm)) {
      legalFormMap[f] = legalFormToOrganizationKind(f);
    }
    return {
      organizationKinds: Object.values(OrganizationKind),
      counterpartyLegalForms: Object.values(CounterpartyLegalForm),
      userRoles: Object.values(UserRole),
      stockMovementTypes: Object.values(StockMovementType),
      stockMovementReasons: Object.values(StockMovementReason),
      taxRateKinds: Object.values(TaxRateKind),
      organizationBankAccountTypes: [...ORGANIZATION_BANK_ACCOUNT_TYPES],
      organizationBankAccountCurrencies: [...ORGANIZATION_BANK_ACCOUNT_CURRENCIES],
      legalFormToOrganizationKind: legalFormMap,
    };
  }
}
