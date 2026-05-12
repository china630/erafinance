import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  StockMovementReason,
  StockMovementType,
  TaxRateKind,
  UserRole,
} from "@erafinance/database";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_INVOICE_VAT_RATES = [-1, 0, 2, 8, 18] as const;

/** Roles that may be assigned via team invite (excludes OWNER). */
const TEAM_INVITE_ROLES: UserRole[] = [
  UserRole.USER,
  UserRole.ACCOUNTANT,
  UserRole.DIRECTOR,
  UserRole.ADMIN,
];

@ApiTags("system")
@ApiBearerAuth("bearer")
@Controller("system")
@UseGuards(RolesGuard)
export class SystemCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("units-of-measure")
  @ApiOperation({ summary: "Active units of measure (global catalog)" })
  listUnitsOfMeasure() {
    return this.prisma.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        code: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
      },
    });
  }

  @Get("currencies")
  @ApiOperation({ summary: "Active ISO 4217 currencies (global catalog)" })
  listCurrencies() {
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        code: true,
        symbol: true,
        decimals: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
      },
    });
  }

  @Get("invoice-vat-rates")
  @ApiOperation({
    summary:
      "Allowed ƏDV/НДС line percents for invoices (from tax_rates; fallback to product default list)",
  })
  async listInvoiceVatRates(): Promise<{ rates: number[] }> {
    const rows = await this.prisma.taxRate.findMany({
      where: { kind: TaxRateKind.VAT, isActive: true },
      select: { code: true, percent: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    const rates = new Set<number>();
    for (const r of rows) {
      const code = r.code.toUpperCase();
      if (code.includes("EXEMPT")) {
        rates.add(-1);
        continue;
      }
      const p = Number(r.percent);
      if (!Number.isFinite(p)) {
        continue;
      }
      const rounded = Math.round(p * 10000) / 10000;
      rates.add(rounded);
    }
    if (rates.size === 0) {
      return { rates: [...DEFAULT_INVOICE_VAT_RATES] };
    }
    return { rates: [...rates].sort((a, b) => a - b) };
  }

  @Get("team-assignable-roles")
  @ApiOperation({ summary: "User roles allowed when inviting org members (API-driven list)" })
  teamAssignableRoles(): { roles: UserRole[] } {
    return { roles: [...TEAM_INVITE_ROLES] };
  }

  @Get("inventory-movement-enums")
  @ApiOperation({
    summary:
      "Stock movement type/reason enum values (matches Prisma; use for filters and UI consistency)",
  })
  inventoryMovementEnums(): {
    types: StockMovementType[];
    reasons: StockMovementReason[];
  } {
    return {
      types: Object.values(StockMovementType),
      reasons: Object.values(StockMovementReason),
    };
  }
}
