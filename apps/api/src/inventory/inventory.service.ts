import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryAdjustmentDocType,
  InventoryAdjustmentStatus,
  InventoryValuationMethod,
  Prisma,
  StockMovementReason,
  StockMovementType,
  UserRole,
} from "@erafinance/database";
import { assertMayPostManualJournal } from "../auth/policies/invoice-finance.policy";
import { AccessControlService } from "../access/access-control.service";
import { getClosedPeriodKeys, monthKeyUtc } from "../reporting/reporting-period.util";
import { randomUUID } from "node:crypto";
import { AccountingService } from "../accounting/accounting.service";
import {
  COGS_ACCOUNT_CODE,
  FINISHED_GOODS_ACCOUNT_CODE,
  INVENTORY_GOODS_ACCOUNT_CODE,
  INVENTORY_SURPLUS_INCOME_ACCOUNT_CODE,
  MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
  PAYABLE_SUPPLIERS_ACCOUNT_CODE,
  RECEIVABLE_ACCOUNT_CODE,
  REVENUE_ACCOUNT_CODE,
  VAT_INPUT_ACCOUNT_CODE,
} from "../ledger.constants";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeListPagination } from "../common/list-pagination";
import { StockService } from "../stock/stock.service";
import type { PurchaseLineDto, PurchaseStockDto } from "./dto/purchase-stock.dto";
import type { TransferStockDto } from "./dto/transfer-stock.dto";
import {
  mergeInventorySettings,
  parseInventorySettings,
  type OrgInventorySettings,
} from "./inventory-settings";
import type { PatchInventorySettingsDto } from "./dto/patch-inventory-settings.dto";
import type { AdjustStockDto } from "./dto/adjust-stock.dto";
import type { CreateInventoryAdjustmentDto } from "./dto/create-inventory-adjustment.dto";
import type { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import type { CreateWarehouseBinDto } from "./dto/create-warehouse-bin.dto";
import type { CreateWarehouseReceiptDto } from "./dto/create-warehouse-receipt.dto";
import type { CreateWarehouseShipmentDto } from "./dto/create-warehouse-shipment.dto";
import type { CreateTransferDto, TransferLineDto } from "./dto/create-transfer.dto";
import { assertWarehouseNotUnderReconciliation } from "./inventory-reconciliation-lock";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly stock: StockService,
    private readonly access: AccessControlService,
  ) {}

  async getInventorySettings(organizationId: string): Promise<
    OrgInventorySettings & {
      defaultWarehouseResolvedId: string | null;
      inventoryValuationMethod: InventoryValuationMethod;
    }
  > {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    const parsed = parseInventorySettings(org?.settings);
    const resolved = await this.resolveDefaultWarehouseId(
      organizationId,
      parsed,
    );
    return {
      ...parsed,
      defaultWarehouseResolvedId: resolved,
      inventoryValuationMethod: org?.valuationMethod ?? "AVCO",
    };
  }

  async patchInventorySettings(
    organizationId: string,
    dto: PatchInventorySettingsDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const next = mergeInventorySettings(org.settings, {
      allowNegativeStock: dto.allowNegativeStock,
      defaultWarehouseId: dto.defaultWarehouseId,
    });
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: next as object },
    });
    return this.getInventorySettings(organizationId);
  }

  async resolveDefaultWarehouseId(
    organizationId: string,
    parsed?: OrgInventorySettings,
  ): Promise<string | null> {
    const p = parsed ?? parseInventorySettings(
      (
        await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { settings: true },
        })
      )?.settings,
    );
    if (p.defaultWarehouseId) {
      const w = await this.prisma.warehouse.findFirst({
        where: { id: p.defaultWarehouseId, organizationId },
      });
      if (w) return w.id;
    }
    const first = await this.prisma.warehouse.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    return first?.id ?? null;
  }

  /**
   * Предупреждения при создании инвойса (продажа): остаток < потребности по строкам с productId.
   */
  async checkSaleAvailability(
    organizationId: string,
    warehouseId: string | null,
    lines: Array<{ productId: string | null; quantity: Decimal }>,
  ): Promise<string[]> {
    const warnings: string[] = [];
    if (!warehouseId) return warnings;

    const byProduct = new Map<string, Decimal>();
    for (const row of lines) {
      if (!row.productId) continue;
      const k = row.productId;
      byProduct.set(k, (byProduct.get(k) ?? new Decimal(0)).add(row.quantity));
    }

    for (const [productId, need] of byProduct) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, organizationId },
        select: { isService: true, name: true },
      });
      if (product?.isService) continue;

      const si = await this.prisma.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId,
            productId,
          },
        },
        include: { product: true },
      });
      const avail = si?.quantity ?? new Decimal(0);
      if (avail.lt(need)) {
        const name = si?.product?.name ?? product?.name ?? productId;
        warnings.push(
          `Недостаточно «${name}»: требуется ${need.toString()}, на складе ${avail.toString()}`,
        );
      }
    }
    return warnings;
  }

  listWarehouses(organizationId: string) {
    return this.prisma.warehouse.findMany({
      where: { organizationId },
      select: { id: true, name: true, inventoryAccountCode: true },
      orderBy: { name: "asc" },
    });
  }

  async createWarehouse(organizationId: string, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        location: (dto.location ?? "").trim(),
      },
    });
  }

  listBins(organizationId: string, warehouseId?: string) {
    return this.prisma.warehouseBin.findMany({
      where: {
        organizationId,
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: { warehouse: { select: { id: true, name: true } } },
      orderBy: [{ warehouseId: "asc" }, { code: "asc" }],
    });
  }

  async createBin(organizationId: string, dto: CreateWarehouseBinDto) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, organizationId },
      select: { id: true },
    });
    if (!warehouse) throw new NotFoundException("Warehouse not found");
    return this.prisma.warehouseBin.create({
      data: {
        organizationId,
        warehouseId: dto.warehouseId,
        code: dto.code.trim(),
        barcode: dto.barcode?.trim() || null,
      },
    });
  }

  async listStock(organizationId: string, warehouseId?: string) {
    return this.prisma.stockItem.findMany({
      where: {
        organizationId,
        ...(warehouseId ? { warehouseId } : {}),
        product: { isService: false },
      },
      include: { product: true, warehouse: true, bin: true },
      orderBy: [{ warehouseId: "asc" }, { product: { name: "asc" } }],
    });
  }

  /**
   * Anbar qalığı: balances from `stock_movements` (SUM(IN) − SUM(OUT)) per warehouse, bin, product.
   * Rows with quantity ≤ 0 are excluded. Goods only (`Product.isService = false`).
   */
  async listMovementBalances(
    organizationId: string,
    filters?: { warehouseId?: string; search?: string; page?: number; pageSize?: number },
  ): Promise<{
    items: Array<{
      warehouseId: string;
      warehouseName: string;
      binId: string | null;
      binCode: string | null;
      productId: string;
      productName: string;
      productSku: string;
      quantity: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page, pageSize, skip } = normalizeListPagination(
      filters?.page,
      filters?.pageSize,
      50,
    );
    const wh = filters?.warehouseId?.trim();
    const search = filters?.search?.trim();
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (wh && !uuidRe.test(wh)) {
      throw new BadRequestException("Invalid warehouseId");
    }

    const warehouseClause = wh
      ? Prisma.sql`AND m.warehouse_id = ${wh}::uuid`
      : Prisma.empty;

    let searchClause = Prisma.empty;
    if (search && search.length > 0) {
      const escaped = search
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
      const pattern = `%${escaped}%`;
      searchClause = Prisma.sql`AND (p.name ILIKE ${pattern} ESCAPE '\\' OR p.sku ILIKE ${pattern} ESCAPE '\\')`;
    }

    const baseFrom = Prisma.sql`
      FROM stock_movements m
      INNER JOIN products p ON p.id = m.product_id AND p.organization_id = m.organization_id
      INNER JOIN warehouses w ON w.id = m.warehouse_id AND w.organization_id = m.organization_id
      LEFT JOIN warehouse_bins b ON b.id = m.bin_id AND b.organization_id = m.organization_id
      WHERE m.organization_id = ${organizationId}::uuid
        AND p.is_service = false
        ${warehouseClause}
        ${searchClause}
      GROUP BY m.warehouse_id, w.name, m.bin_id, b.code, m.product_id, p.name, p.sku
      HAVING COALESCE(SUM(CASE WHEN m.type::text = 'IN' THEN m.quantity ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN m.type::text = 'OUT' THEN m.quantity ELSE 0 END), 0) > 0
    `;

    const countRows = await this.prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS c FROM (
        SELECT 1
        ${baseFrom}
      ) sub
    `);
    const total = Number(countRows[0]?.c ?? 0);

    const rows = await this.prisma.$queryRaw<
      Array<{
        warehouse_id: string;
        warehouse_name: string;
        bin_id: string | null;
        bin_code: string | null;
        product_id: string;
        product_name: string;
        product_sku: string;
        quantity: unknown;
      }>
    >(Prisma.sql`
      SELECT
        m.warehouse_id,
        w.name AS warehouse_name,
        m.bin_id,
        b.code AS bin_code,
        m.product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        COALESCE(SUM(CASE WHEN m.type::text = 'IN' THEN m.quantity ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN m.type::text = 'OUT' THEN m.quantity ELSE 0 END), 0) AS quantity
      ${baseFrom}
      ORDER BY w.name ASC, b.code ASC NULLS LAST, p.name ASC
      LIMIT ${pageSize} OFFSET ${skip}
    `);

    return {
      items: rows.map((r) => ({
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        binId: r.bin_id,
        binCode: r.bin_code,
        productId: r.product_id,
        productName: r.product_name,
        productSku: r.product_sku,
        quantity: String(r.quantity),
      })),
      total,
      page,
      pageSize,
    };
  }

  async listMovements(
    organizationId: string,
    filters?: {
      warehouseId?: string;
      productId?: string;
      page?: number;
      pageSize?: number;
      note?: string;
      notes?: string[];
      type?: StockMovementType;
      reason?: StockMovementReason;
    },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      filters?.page,
      filters?.pageSize,
      25,
    );
    const noteFilter =
      filters?.notes && filters.notes.length > 0
        ? { note: { in: filters.notes } }
        : filters?.note
          ? { note: filters.note }
          : {};
    const where = {
      organizationId,
      ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.reason ? { reason: filters.reason } : {}),
      ...noteFilter,
      product: { isService: false },
    };
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: true,
          warehouse: true,
          bin: true,
          invoice: { select: { number: true, id: true } },
        },
        orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Цена за ед. без НДС для оценки запасов / расхода (если в форме цена с НДС). */
  private purchaseNetUnit(
    enteredUnit: Decimal,
    vatRatePct: Decimal,
    pricesIncludeVat: boolean,
  ): Decimal {
    if (!pricesIncludeVat) return enteredUnit;
    const denom = new Decimal(1).add(vatRatePct.div(100));
    return enteredUnit.div(denom);
  }

  /** Effective VAT % for a purchase line (UI vatMode overrides product catalog). */
  private purchaseLineVatRatePercent(
    line: Pick<PurchaseLineDto, "vatMode">,
    productVatRate: unknown,
  ): Decimal {
    const m = line.vatMode;
    if (m === "18") return new Decimal(18);
    if (m === "0" || m === "exempt" || m === "not_applicable") {
      return new Decimal(0);
    }
    return new Decimal(productVatRate != null ? Number(productVatRate) : 0);
  }

  private normalizePurchaseSplit(dto: PurchaseStockDto): {
    goodsLines: PurchaseLineDto[];
    serviceLines: PurchaseLineDto[];
  } {
    const gl = dto.goodsLines;
    const sl = dto.serviceLines;
    if ((gl && gl.length > 0) || (sl && sl.length > 0)) {
      return { goodsLines: gl ?? [], serviceLines: sl ?? [] };
    }
    if (dto.lines?.length) {
      const kind = dto.kind ?? "goods";
      if (kind === "services") {
        return { goodsLines: [], serviceLines: dto.lines };
      }
      return { goodsLines: dto.lines, serviceLines: [] };
    }
    return { goodsLines: [], serviceLines: [] };
  }

  async recordPurchase(organizationId: string, dto: PurchaseStockDto) {
    const pricesIncludeVat = Boolean(dto.pricesIncludeVat);
    const { goodsLines, serviceLines } = this.normalizePurchaseSplit(dto);
    if (goodsLines.length === 0 && serviceLines.length === 0) {
      throw new BadRequestException("At least one purchase line is required");
    }
    if (goodsLines.length > 0 && serviceLines.length > 0) {
      return this.recordDualPurchaseInvoice(
        organizationId,
        dto,
        goodsLines,
        serviceLines,
        pricesIncludeVat,
      );
    }
    if (serviceLines.length > 0) {
      return this.recordServicePurchase(
        organizationId,
        { ...dto, lines: serviceLines },
        pricesIncludeVat,
      );
    }
    return this.recordGoodsPurchase(organizationId, { ...dto, lines: goodsLines }, pricesIncludeVat);
  }

  /**
   * Single journal: Дт 201 (goods net) + Дт 731 (services net) + Дт 241 (VAT if prices include VAT) — Кт 531.
   * Amounts converted to AZN using fxRateToAzn (1 for AZN).
   */
  private async recordDualPurchaseInvoice(
    organizationId: string,
    dto: PurchaseStockDto,
    goodsLines: PurchaseLineDto[],
    serviceLines: PurchaseLineDto[],
    pricesIncludeVat: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const documentDate = dto.documentDate ? new Date(dto.documentDate) : new Date();
      if (Number.isNaN(documentDate.getTime())) {
        throw new BadRequestException("Invalid documentDate");
      }

      let totalNetGoods = new Decimal(0);
      let totalNetSvc = new Decimal(0);
      let totalVat = new Decimal(0);
      let totalGross = new Decimal(0);
      const snapshotLines: Array<{
        kind: "goods" | "services";
        productId: string;
        quantity: number;
        productName: string;
        sku: string;
      }> = [];

      for (let lineIndex = 0; lineIndex < goodsLines.length; lineIndex++) {
        const line = goodsLines[lineIndex];
        const p = await tx.product.findFirst({
          where: { id: line.productId, organizationId },
        });
        if (!p) {
          throw new NotFoundException(`Product ${line.productId} not found`);
        }
        if (p.isService) {
          throw new BadRequestException(
            `Mallar sətri ${lineIndex + 1}: gözlənilən məhsul (isService=false)`,
          );
        }
        snapshotLines.push({
          kind: "goods",
          productId: line.productId,
          quantity: Number(line.quantity),
          productName: p.name,
          sku: typeof p.sku === "string" ? p.sku : String(p.sku ?? ""),
        });
        const qty = new Decimal(line.quantity);
        const grossUnit = new Decimal(line.unitPrice);
        const vatRate = this.purchaseLineVatRatePercent(line, p.vatRate);
        const netUnit = this.purchaseNetUnit(grossUnit, vatRate, pricesIncludeVat);
        const lineNet = qty.mul(netUnit);
        const lineGross = pricesIncludeVat ? qty.mul(grossUnit) : lineNet;
        const lineVat = lineGross.sub(lineNet);
        totalNetGoods = totalNetGoods.add(lineNet);
        totalVat = totalVat.add(lineVat);
        totalGross = totalGross.add(lineGross);
      }

      for (let lineIndex = 0; lineIndex < serviceLines.length; lineIndex++) {
        const line = serviceLines[lineIndex];
        const p = await tx.product.findFirst({
          where: { id: line.productId, organizationId },
        });
        if (!p) {
          throw new NotFoundException(`Product ${line.productId} not found`);
        }
        if (!p.isService) {
          throw new BadRequestException(
            `Xidmətlər sətiri ${lineIndex + 1}: gözlənilən xidmət (isService=true)`,
          );
        }
        snapshotLines.push({
          kind: "services",
          productId: line.productId,
          quantity: Number(line.quantity),
          productName: p.name,
          sku: typeof p.sku === "string" ? p.sku : String(p.sku ?? ""),
        });
        const qty = new Decimal(line.quantity);
        const grossUnit = new Decimal(line.unitPrice);
        const vatRate = this.purchaseLineVatRatePercent(line, p.vatRate);
        const netUnit = this.purchaseNetUnit(grossUnit, vatRate, pricesIncludeVat);
        const lineNet = qty.mul(netUnit);
        const lineGross = pricesIncludeVat ? qty.mul(grossUnit) : lineNet;
        const lineVat = lineGross.sub(lineNet);
        totalNetSvc = totalNetSvc.add(lineNet);
        totalVat = totalVat.add(lineVat);
        totalGross = totalGross.add(lineGross);
      }

      const cur = (dto.currency ?? "AZN").toUpperCase();
      let fx = new Decimal(dto.fxRateToAzn ?? 1);
      if (cur === "AZN") {
        fx = new Decimal(1);
      }
      if (fx.lte(0)) {
        throw new BadRequestException("fxRateToAzn must be greater than 0");
      }

      const gAz = totalNetGoods.mul(fx);
      const sAz = totalNetSvc.mul(fx);
      const vAz = totalVat.mul(fx);
      const grAz = totalGross.mul(fx);

      const lines =
        vAz.gt(0) && pricesIncludeVat
          ? [
              ...(gAz.gt(0)
                ? [
                    {
                      accountCode: INVENTORY_GOODS_ACCOUNT_CODE,
                      debit: gAz.toString(),
                      credit: 0,
                    },
                  ]
                : []),
              ...(sAz.gt(0)
                ? [
                    {
                      accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
                      debit: sAz.toString(),
                      credit: 0,
                    },
                  ]
                : []),
              {
                accountCode: VAT_INPUT_ACCOUNT_CODE,
                debit: vAz.toString(),
                credit: 0,
              },
              {
                accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
                debit: 0,
                credit: grAz.toString(),
              },
            ]
          : [
              ...(gAz.gt(0)
                ? [
                    {
                      accountCode: INVENTORY_GOODS_ACCOUNT_CODE,
                      debit: gAz.toString(),
                      credit: 0,
                    },
                  ]
                : []),
              ...(sAz.gt(0)
                ? [
                    {
                      accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
                      debit: sAz.toString(),
                      credit: 0,
                    },
                  ]
                : []),
              {
                accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
                debit: 0,
                credit: grAz.toString(),
              },
            ];

      const journalRef = dto.reference?.trim() || "PURCHASE_INVOICE";
      const desc = pricesIncludeVat
        ? `Alış fakturası — mallar və xidmətlər (${cur}, fx=${fx.toString()}, qiymətlər ƏDV daxil)`
        : `Alış fakturası — mallar və xidmətlər (${cur}, fx=${fx.toString()})`;

      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: documentDate,
        reference: journalRef,
        description: desc,
        counterpartyId: dto.counterpartyId ?? null,
        lines,
      });
      await tx.transaction.update({
        where: { id: transactionId, organizationId },
        data: {
          purchaseSnapshot: { version: 1, lines: snapshotLines } as Prisma.InputJsonValue,
        },
      });

      return {
        totalAmount: totalGross.toString(),
        netAmount: totalNetGoods.add(totalNetSvc).toString(),
        vatAmount: totalVat.toString(),
        lines: goodsLines.length + serviceLines.length,
      };
    });
  }

  /**
   * Purchase invoice (goods): GL only (201 / 241 / 531). No StockMovement — warehouse receipt is a separate future document.
   */
  private async recordGoodsPurchase(
    organizationId: string,
    dto: PurchaseStockDto,
    pricesIncludeVat: boolean,
  ) {
    const purchaseLines = dto.lines;
    if (!purchaseLines?.length) {
      throw new BadRequestException("At least one purchase line is required");
    }
    return this.prisma.$transaction(async (tx) => {
      const documentDate = dto.documentDate ? new Date(dto.documentDate) : new Date();
      if (Number.isNaN(documentDate.getTime())) {
        throw new BadRequestException("Invalid documentDate");
      }
      let totalNet = new Decimal(0);
      let totalVat = new Decimal(0);
      let totalGross = new Decimal(0);
      const snapshotLines: Array<{
        kind: "goods";
        productId: string;
        quantity: number;
        productName: string;
        sku: string;
      }> = [];

      for (let lineIndex = 0; lineIndex < purchaseLines.length; lineIndex++) {
        const line = purchaseLines[lineIndex];
        const p = await tx.product.findFirst({
          where: { id: line.productId, organizationId },
        });
        if (!p) {
          throw new NotFoundException(`Product ${line.productId} not found`);
        }
        if (p.isService) {
          throw new BadRequestException(
            `Строка ${lineIndex + 1}: услуга не может быть в alış fakturası (товары); выберите тип «Услуги»`,
          );
        }
        snapshotLines.push({
          kind: "goods",
          productId: line.productId,
          quantity: Number(line.quantity),
          productName: p.name,
          sku: typeof p.sku === "string" ? p.sku : String(p.sku ?? ""),
        });
        const qty = new Decimal(line.quantity);
        const grossUnit = new Decimal(line.unitPrice);
        const vatRate = this.purchaseLineVatRatePercent(line, p.vatRate);
        const netUnit = this.purchaseNetUnit(grossUnit, vatRate, pricesIncludeVat);
        const lineNet = qty.mul(netUnit);
        const lineGross = pricesIncludeVat ? qty.mul(grossUnit) : lineNet;
        const lineVat = lineGross.sub(lineNet);
        totalNet = totalNet.add(lineNet);
        totalVat = totalVat.add(lineVat);
        totalGross = totalGross.add(lineGross);
      }

      const cur = (dto.currency ?? "AZN").toUpperCase();
      let fx = new Decimal(dto.fxRateToAzn ?? 1);
      if (cur === "AZN") {
        fx = new Decimal(1);
      }
      if (fx.lte(0)) {
        throw new BadRequestException("fxRateToAzn must be greater than 0");
      }
      const nAz = totalNet.mul(fx);
      const vAz = totalVat.mul(fx);
      const gAz = totalGross.mul(fx);

      const journalLines =
        totalVat.gt(0) && pricesIncludeVat
          ? [
              {
                accountCode: INVENTORY_GOODS_ACCOUNT_CODE,
                debit: nAz.toString(),
                credit: 0,
              },
              {
                accountCode: VAT_INPUT_ACCOUNT_CODE,
                debit: vAz.toString(),
                credit: 0,
              },
              {
                accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
                debit: 0,
                credit: gAz.toString(),
              },
            ]
          : [
              {
                accountCode: INVENTORY_GOODS_ACCOUNT_CODE,
                debit: nAz.toString(),
                credit: 0,
              },
              {
                accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
                debit: 0,
                credit: gAz.toString(),
              },
            ];

      const journalRef = dto.reference?.trim() || "PURCHASE_INVOICE";
      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: documentDate,
        reference: journalRef,
        description: pricesIncludeVat
          ? `Alış fakturası — mallar (${cur}, fx=${fx.toString()}, qiymətlər ƏDV daxil)`
          : `Alış fakturası — mallar (${cur}, fx=${fx.toString()})`,
        counterpartyId: dto.counterpartyId ?? null,
        lines: journalLines,
      });
      await tx.transaction.update({
        where: { id: transactionId, organizationId },
        data: {
          purchaseSnapshot: { version: 1, lines: snapshotLines } as Prisma.InputJsonValue,
        },
      });

      return {
        totalAmount: totalGross.toString(),
        netAmount: totalNet.toString(),
        vatAmount: totalVat.toString(),
        lines: purchaseLines.length,
      };
    });
  }

  /** GL-backed purchase invoices (no per-line product breakdown in this list). */
  async listPurchaseInvoices(
    organizationId: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where = {
      organizationId,
      OR: [
        { reference: "PURCHASE_INVOICE" },
        {
          AND: [
            { reference: "WEB" },
            {
              OR: [
                { description: { contains: "Закупка товара" } },
                { description: { contains: "Закупка услуги" } },
              ],
            },
          ],
        },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          journalEntries: { include: { account: { select: { code: true } } } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        reason: StockMovementReason.RECEIPT,
        note: { contains: "BASIS_TX:" },
      },
      select: { note: true },
    });
    const receivedTxIds = new Set<string>();
    for (const m of movements) {
      const parts = (m.note ?? "").split("|");
      const basis = parts.find((p) => p.startsWith("BASIS_TX:"));
      if (basis) {
        receivedTxIds.add(basis.slice("BASIS_TX:".length));
      }
    }

    const items = rows.map((tr) => {
      let credit531 = new Decimal(0);
      for (const je of tr.journalEntries) {
        if (je.account.code === PAYABLE_SUPPLIERS_ACCOUNT_CODE) {
          credit531 = credit531.add(je.credit);
        }
      }
      const desc = tr.description ?? "";
      let kind: "goods" | "services" | "dual" = "goods";
      if (desc.includes("mallar və xidmətlər")) {
        kind = "dual";
      } else if (
        desc.includes("xidmət") ||
        desc.includes("услуг") ||
        desc.toLowerCase().includes("service")
      ) {
        kind = "services";
      }

      let receiptStatus: "pending" | "received" | "na" = "na";
      if (kind === "goods" || kind === "dual") {
        receiptStatus = receivedTxIds.has(tr.id) ? "received" : "pending";
      }

      return {
        id: tr.id,
        documentDate: tr.date.toISOString(),
        createdAt: tr.createdAt.toISOString(),
        description: tr.description,
        reference: tr.reference,
        kind,
        receiptStatus,
        totalGross: credit531.toString(),
      };
    });

    return { items, total, page, pageSize };
  }

  /**
   * Posted alış fakturası: line snapshot for warehouse receipt autofill (`purchaseSnapshot`).
   */
  async getPurchaseInvoiceDetail(organizationId: string, transactionId: string) {
    const tr = await this.prisma.transaction.findFirst({
      where: { id: transactionId, organizationId },
      select: {
        id: true,
        date: true,
        description: true,
        reference: true,
        purchaseSnapshot: true,
      },
    });
    if (!tr) {
      throw new NotFoundException("Purchase invoice not found");
    }
    const desc = tr.description ?? "";
    const isPurchase =
      tr.reference === "PURCHASE_INVOICE" ||
      (tr.reference === "WEB" &&
        (desc.includes("Закупка товара") ||
          desc.includes("Закупка услуги") ||
          desc.includes("xidmət")));
    if (!isPurchase) {
      throw new BadRequestException("Not a purchase invoice transaction");
    }
    const kind = this.purchaseDocumentKindFromDescription(desc);
    const lines = this.parsePurchaseSnapshotLines(tr.purchaseSnapshot);
    return {
      id: tr.id,
      documentDate: tr.date.toISOString(),
      kind,
      lines,
    };
  }

  private purchaseDocumentKindFromDescription(desc: string): "goods" | "services" | "dual" {
    if (desc.includes("mallar və xidmətlər")) {
      return "dual";
    }
    if (
      desc.includes("xidmət") ||
      desc.includes("услуг") ||
      desc.toLowerCase().includes("service")
    ) {
      return "services";
    }
    return "goods";
  }

  private parsePurchaseSnapshotLines(
    raw: Prisma.JsonValue | null | undefined,
  ): Array<{
    kind: "goods" | "services";
    productId: string;
    quantity: number;
    productName: string;
    sku: string;
  }> {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return [];
    }
    const obj = raw as Record<string, unknown>;
    const arr = obj.lines;
    if (!Array.isArray(arr)) {
      return [];
    }
    const out: Array<{
      kind: "goods" | "services";
      productId: string;
      quantity: number;
      productName: string;
      sku: string;
    }> = [];
    for (const row of arr) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const productId = typeof r.productId === "string" ? r.productId : "";
      const kind: "goods" | "services" =
        r.kind === "services" ? "services" : r.kind === "goods" ? "goods" : "goods";
      const qty = typeof r.quantity === "number" ? r.quantity : Number(r.quantity);
      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
      out.push({
        kind,
        productId,
        quantity: qty,
        productName: typeof r.productName === "string" ? r.productName : "",
        sku: typeof r.sku === "string" ? r.sku : "",
      });
    }
    return out;
  }

  private isSalesRevenueDescription(description: string | null | undefined): boolean {
    const d = description ?? "";
    return d.includes("Отгрузка / выручка по");
  }

  private parseSalesSnapshotBody(raw: Prisma.JsonValue | null | undefined): {
    invoiceId?: string;
    lines: Array<{
      kind: "goods";
      productId: string;
      quantity: number;
      productName: string;
      sku: string;
    }>;
  } {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return { lines: [] };
    }
    const obj = raw as Record<string, unknown>;
    const invoiceId = typeof obj.invoiceId === "string" ? obj.invoiceId : undefined;
    const arr = obj.lines;
    if (!Array.isArray(arr)) {
      return { invoiceId, lines: [] };
    }
    const lines: Array<{
      kind: "goods";
      productId: string;
      quantity: number;
      productName: string;
      sku: string;
    }> = [];
    for (const row of arr) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const productId = typeof r.productId === "string" ? r.productId : "";
      const qty = typeof r.quantity === "number" ? r.quantity : Number(r.quantity);
      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
      lines.push({
        kind: "goods",
        productId,
        quantity: qty,
        productName: typeof r.productName === "string" ? r.productName : "",
        sku: typeof r.sku === "string" ? r.sku : "",
      });
    }
    return { invoiceId, lines };
  }

  /**
   * Revenue recognition journal (Dt 211 / Ct 601) + `sales_snapshot` on the created transaction.
   * Physical stock issue + COGS are performed by `recordWarehouseShipment`.
   */
  async applyRevenueRecognitionWithSalesSnapshot(
    tx: Prisma.TransactionClient,
    organizationId: string,
    invoiceId: string,
    totalAmount: Decimal,
  ): Promise<{ transactionId: string }> {
    const full = await tx.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, isService: true } },
          },
        },
      },
    });
    if (!full) {
      throw new NotFoundException("Invoice not found");
    }

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date: new Date(),
      reference: full.number,
      description: `Отгрузка / выручка по ${full.number} (Дт ${RECEIVABLE_ACCOUNT_CODE} Кт ${REVENUE_ACCOUNT_CODE})`,
      lines: [
        {
          accountCode: RECEIVABLE_ACCOUNT_CODE,
          debit: totalAmount.toString(),
          credit: 0,
        },
        {
          accountCode: REVENUE_ACCOUNT_CODE,
          debit: 0,
          credit: totalAmount.toString(),
        },
      ],
    });

    const snapshotLines: Array<{
      kind: "goods";
      productId: string;
      quantity: number;
      productName: string;
      sku: string;
    }> = [];

    for (const item of full.items) {
      if (!item.productId || !item.product) {
        continue;
      }
      if (item.product.isService) {
        continue;
      }
      snapshotLines.push({
        kind: "goods",
        productId: item.productId,
        quantity: Number(item.quantity),
        productName: item.product.name,
        sku:
          typeof item.product.sku === "string"
            ? item.product.sku
            : String(item.product.sku ?? ""),
      });
    }

    await tx.transaction.update({
      where: { id: transactionId, organizationId },
      data: {
        salesSnapshot: {
          version: 1,
          invoiceId: full.id,
          lines: snapshotLines,
        } as Prisma.InputJsonValue,
      },
    });

    if (snapshotLines.length === 0) {
      await tx.invoice.update({
        where: { id: full.id },
        data: { inventorySettled: true },
      });
    }

    return { transactionId };
  }

  /** Posted Satış revenue transactions for outbound order basis picker. */
  async listSalesInvoices(organizationId: string, take = 400) {
    const rows = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        description: { contains: "Отгрузка / выручка по" },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        date: true,
        createdAt: true,
        description: true,
        reference: true,
        salesSnapshot: true,
      },
    });

    const refs = [...new Set(rows.map((r) => r.reference).filter((x): x is string => !!x?.trim()))];
    const invoices =
      refs.length > 0
        ? await this.prisma.invoice.findMany({
            where: { organizationId, number: { in: refs } },
            select: {
              number: true,
              inventorySettled: true,
              id: true,
              items: {
                select: {
                  productId: true,
                  product: { select: { isService: true } },
                },
              },
            },
          })
        : [];
    const invByNumber = new Map(invoices.map((i) => [i.number, i]));

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        reason: StockMovementReason.SHIPMENT,
        note: { contains: "BASIS_TX:" },
      },
      select: { note: true },
    });
    const shippedTxIds = new Set<string>();
    for (const m of movements) {
      const parts = (m.note ?? "").split("|");
      const basis = parts.find((p) => p.startsWith("BASIS_TX:"));
      if (basis) {
        shippedTxIds.add(basis.slice("BASIS_TX:".length));
      }
    }

    return rows.map((tr) => {
      const inv = tr.reference ? invByNumber.get(tr.reference) : undefined;
      let kind: "goods" | "services" | "dual" = "goods";
      if (inv?.items?.length) {
        let hasG = false;
        let hasS = false;
        for (const it of inv.items) {
          if (!it.productId) continue;
          if (it.product?.isService) hasS = true;
          else hasG = true;
        }
        if (hasG && hasS) kind = "dual";
        else if (hasS && !hasG) kind = "services";
        else kind = "goods";
      }

      let shipmentStatus: "pending" | "shipped" | "na" = "na";
      if (kind === "goods" || kind === "dual") {
        if (inv?.inventorySettled) {
          shipmentStatus = "shipped";
        } else if (shippedTxIds.has(tr.id)) {
          shipmentStatus = "shipped";
        } else {
          shipmentStatus = "pending";
        }
      }

      const snapLines = this.parseSalesSnapshotBody(tr.salesSnapshot).lines;
      let totalGoods = new Decimal(0);
      for (const ln of snapLines) {
        totalGoods = totalGoods.add(ln.quantity);
      }

      return {
        id: tr.id,
        documentDate: tr.date.toISOString(),
        createdAt: tr.createdAt.toISOString(),
        description: tr.description,
        reference: tr.reference,
        kind,
        shipmentStatus,
        invoiceNumber: tr.reference ?? null,
        goodsLineCount: snapLines.length,
        goodsQuantity: totalGoods.toString(),
      };
    });
  }

  /**
   * Posted Satış fakturası (revenue `Transaction.id`): goods lines from `sales_snapshot`
   * (fallback: live `Invoice` lines for legacy postings).
   */
  async getSalesInvoiceDetail(organizationId: string, transactionId: string) {
    const tr = await this.prisma.transaction.findFirst({
      where: { id: transactionId, organizationId },
      select: {
        id: true,
        date: true,
        description: true,
        reference: true,
        salesSnapshot: true,
      },
    });
    if (!tr) {
      throw new NotFoundException("Sales invoice not found");
    }
    if (!this.isSalesRevenueDescription(tr.description)) {
      throw new BadRequestException("Not a sales revenue transaction");
    }

    const parsed = this.parseSalesSnapshotBody(tr.salesSnapshot);
    let lines = parsed.lines;
    let invoiceId = parsed.invoiceId;

    if ((!lines.length || !invoiceId) && tr.reference) {
      const inv = await this.prisma.invoice.findFirst({
        where: { organizationId, number: tr.reference },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, isService: true } },
            },
          },
        },
      });
      if (inv) {
        invoiceId = invoiceId ?? inv.id;
        if (!lines.length) {
          for (const item of inv.items) {
            if (!item.productId || !item.product || item.product.isService) continue;
            lines.push({
              kind: "goods",
              productId: item.productId,
              quantity: Number(item.quantity),
              productName: item.product.name,
              sku:
                typeof item.product.sku === "string"
                  ? item.product.sku
                  : String(item.product.sku ?? ""),
            });
          }
        }
      }
    }

    let kind: "goods" | "services" | "dual" = "goods";
    if (invoiceId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: {
          items: {
            include: {
              product: { select: { isService: true } },
            },
          },
        },
      });
      if (inv?.items?.length) {
        let hasG = false;
        let hasS = false;
        for (const it of inv.items) {
          if (!it.productId) continue;
          if (it.product?.isService) hasS = true;
          else hasG = true;
        }
        if (hasG && hasS) kind = "dual";
        else if (hasS && !hasG) kind = "services";
        else kind = "goods";
      }
    }

    return {
      id: tr.id,
      invoiceId: invoiceId ?? null,
      documentDate: tr.date.toISOString(),
      kind,
      lines,
    };
  }

  /**
   * Anbar məxarici orderi: physical goods issue + COGS (701/201). Optional link to revenue transaction.
   */
  async recordWarehouseShipment(organizationId: string, dto: CreateWarehouseShipmentDto) {
    if (!dto.basisTransactionId) {
      throw new BadRequestException("basisTransactionId is required for warehouse shipment");
    }
    const documentDate = new Date(dto.date);
    if (Number.isNaN(documentDate.getTime())) {
      throw new BadRequestException("Invalid document date");
    }

    const productIds = dto.lines.map((l) => l.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException("Duplicate productId in shipment lines");
    }

    return this.prisma.$transaction(async (tx) => {
      const wh = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, organizationId },
        select: { id: true },
      });
      if (!wh) {
        throw new NotFoundException("Warehouse not found");
      }

      await assertWarehouseNotUnderReconciliation(tx, organizationId, dto.warehouseId);

      const basisId = dto.basisTransactionId;
      const tr = await tx.transaction.findFirst({
        where: { id: basisId, organizationId },
        select: { id: true, description: true, reference: true, salesSnapshot: true },
      });
      if (!tr) {
        throw new NotFoundException("Basis transaction not found");
      }
      if (!this.isSalesRevenueDescription(tr.description)) {
        throw new BadRequestException(
          "Basis must be a posted sales revenue transaction (Satış fakturası)",
        );
      }

      const parsed = this.parseSalesSnapshotBody(tr.salesSnapshot);
      let invoiceId = parsed.invoiceId;
      if (!invoiceId && tr.reference) {
        const invByNum = await tx.invoice.findFirst({
          where: { organizationId, number: tr.reference },
          select: { id: true },
        });
        invoiceId = invByNum?.id;
      }
      if (!invoiceId) {
        throw new BadRequestException("Cannot resolve invoice for this revenue transaction");
      }

      const inv = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: {
          items: {
            include: {
              product: { select: { isService: true } },
            },
          },
        },
      });
      if (!inv) {
        throw new NotFoundException("Invoice not found");
      }
      if (inv.inventorySettled) {
        throw new BadRequestException(
          "Warehouse shipment for this invoice is already recorded",
        );
      }

      const maxQtyByProduct = new Map<string, Decimal>();
      for (const it of inv.items) {
        if (!it.productId || it.product?.isService) continue;
        const prev = maxQtyByProduct.get(it.productId) ?? new Decimal(0);
        maxQtyByProduct.set(it.productId, prev.add(it.quantity));
      }

      if (maxQtyByProduct.size === 0) {
        throw new BadRequestException("Invoice has no goods lines to ship");
      }

      const invGoodsIds = new Set(maxQtyByProduct.keys());
      const shipIds = new Set(dto.lines.map((l) => l.productId));
      if (shipIds.size !== invGoodsIds.size) {
        throw new BadRequestException("Shipment lines must include exactly all goods invoice lines");
      }
      for (const pid of invGoodsIds) {
        if (!shipIds.has(pid)) {
          throw new BadRequestException("Shipment lines must include exactly all goods invoice lines");
        }
      }
      for (const line of dto.lines) {
        const maxQty = maxQtyByProduct.get(line.productId);
        if (!maxQty || !new Decimal(line.quantity).eq(maxQty)) {
          throw new BadRequestException(
            "Each shipment line quantity must match the invoiced quantity for that product",
          );
        }
      }

      const binIds = [
        ...new Set(dto.lines.map((l) => l.binId).filter((id): id is string => !!id)),
      ];
      if (binIds.length > 0) {
        const bins = await tx.warehouseBin.findMany({
          where: { organizationId, id: { in: binIds } },
          select: { id: true, warehouseId: true },
        });
        const binMap = new Map(bins.map((b) => [b.id, b]));
        for (const id of binIds) {
          const b = binMap.get(id);
          if (!b) {
            throw new NotFoundException(`Bin ${id} not found`);
          }
          if (b.warehouseId !== dto.warehouseId) {
            throw new BadRequestException("Bin does not belong to the selected warehouse");
          }
        }
      }

      let totalCogs = new Decimal(0);

      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const pid = line.productId;
        const need = new Decimal(line.quantity);

        const p = await tx.product.findFirst({
          where: { id: pid, organizationId },
          select: { isService: true },
        });
        if (!p) {
          throw new NotFoundException(`Product ${pid} not found`);
        }
        if (p.isService) {
          throw new BadRequestException(
            `Line ${i + 1}: service items cannot be shipped from stock`,
          );
        }

        const si = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: dto.warehouseId,
              productId: pid,
            },
          },
        });
        const avail = si?.quantity ?? new Decimal(0);
        const avg = si?.averageCost ?? new Decimal(0);
        const invLine = inv.items.find((it) => it.productId === pid && !it.product?.isService);
        const fallbackPrice = invLine ? new Decimal(invLine.unitPrice) : new Decimal(0);
        const unitCost = await this.stock.computeIssueUnitCost(
          tx,
          organizationId,
          dto.warehouseId,
          pid,
          need,
          avg,
          fallbackPrice.gt(0) ? fallbackPrice : avg,
        );

        if (avail.lt(need)) {
          throw new BadRequestException(`Insufficient stock for shipment (product ${pid})`);
        }

        const lineCogs = need.mul(unitCost);
        totalCogs = totalCogs.add(lineCogs);
        const newQty = avail.sub(need);

        await tx.stockItem.upsert({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: dto.warehouseId,
              productId: pid,
            },
          },
          create: {
            organizationId,
            warehouseId: dto.warehouseId,
            productId: pid,
            quantity: newQty,
            averageCost: unitCost,
          },
          update: {
            quantity: newQty,
          },
        });

        const noteParts = ["SHIPMENT", `BASIS_TX:${basisId}`];
        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: dto.warehouseId,
            productId: pid,
            binId: line.binId ?? null,
            type: StockMovementType.OUT,
            reason: StockMovementReason.SHIPMENT,
            quantity: need,
            price: unitCost,
            invoiceId: inv.id,
            note: noteParts.join("|"),
            documentDate,
          },
        });
      }

      if (totalCogs.gt(0)) {
        await this.accounting.postJournalInTransaction(tx, {
          organizationId,
          date: documentDate,
          reference: inv.number,
          description: `Себестоимость (məxaric) по инвойсу ${inv.number}`,
          lines: [
            {
              accountCode: COGS_ACCOUNT_CODE,
              debit: totalCogs.toString(),
              credit: 0,
            },
            {
              accountCode: INVENTORY_GOODS_ACCOUNT_CODE,
              debit: 0,
              credit: totalCogs.toString(),
            },
          ],
        });
      }

      await tx.invoice.update({
        where: { id: inv.id },
        data: { inventorySettled: true },
      });

      return { linesPosted: dto.lines.length };
    });
  }

  /**
   * Anbar mədaxil orderi: physical goods receipt (quantity only). No GL.
   * Optional link to posted alış fakturası via `basisTransactionId` (stored in movement note).
   */
  async recordWarehouseReceipt(organizationId: string, dto: CreateWarehouseReceiptDto) {
    const documentDate = new Date(dto.date);
    if (Number.isNaN(documentDate.getTime())) {
      throw new BadRequestException("Invalid document date");
    }

    const productIds = dto.lines.map((l) => l.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException("Duplicate productId in receipt lines");
    }

    return this.prisma.$transaction(async (tx) => {
      const wh = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, organizationId },
        select: { id: true },
      });
      if (!wh) {
        throw new NotFoundException("Warehouse not found");
      }

      await assertWarehouseNotUnderReconciliation(tx, organizationId, dto.warehouseId);

      if (dto.basisTransactionId) {
        const tr = await tx.transaction.findFirst({
          where: { id: dto.basisTransactionId, organizationId },
          select: { id: true, reference: true, description: true },
        });
        if (!tr) {
          throw new NotFoundException("Basis transaction not found");
        }
        const desc = tr.description ?? "";
        const isPurchase =
          tr.reference === "PURCHASE_INVOICE" ||
          (tr.reference === "WEB" &&
            (desc.includes("Закупка товара") ||
              desc.includes("Закупка услуги") ||
              desc.includes("xidmət")));
        if (!isPurchase) {
          throw new BadRequestException(
            "Basis must be a posted purchase invoice (alış fakturası)",
          );
        }
        const isDualOrGoods =
          desc.includes("mallar") ||
          desc.includes("Mallar") ||
          desc.includes("товар");
        const isServicesOnly =
          !isDualOrGoods &&
          (desc.includes("xidmət") ||
            desc.includes("услуг") ||
            desc.toLowerCase().includes("service"));
        if (isServicesOnly) {
          throw new BadRequestException(
            "Basis for warehouse receipt must include goods (mallar) lines",
          );
        }
      }

      const binIds = [
        ...new Set(dto.lines.map((l) => l.binId).filter((id): id is string => !!id)),
      ];
      if (binIds.length > 0) {
        const bins = await tx.warehouseBin.findMany({
          where: { organizationId, id: { in: binIds } },
          select: { id: true, warehouseId: true },
        });
        const binMap = new Map(bins.map((b) => [b.id, b]));
        for (const id of binIds) {
          const b = binMap.get(id);
          if (!b) {
            throw new NotFoundException(`Bin ${id} not found`);
          }
          if (b.warehouseId !== dto.warehouseId) {
            throw new BadRequestException("Bin does not belong to the selected warehouse");
          }
        }
      }

      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const p = await tx.product.findFirst({
          where: { id: line.productId, organizationId },
          select: { isService: true },
        });
        if (!p) {
          throw new NotFoundException(`Product ${line.productId} not found`);
        }
        if (p.isService) {
          throw new BadRequestException(
            `Line ${i + 1}: service items cannot be received on stock`,
          );
        }

        const qty = new Decimal(line.quantity);
        const unit = new Decimal(0);

        const existing = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: dto.warehouseId,
              productId: line.productId,
            },
          },
        });

        const q0 = existing?.quantity ?? new Decimal(0);
        const c0 = existing?.averageCost ?? new Decimal(0);
        const q1 = q0.add(qty);
        const c1 = q1.lte(0)
          ? new Decimal(0)
          : q0.lte(0)
            ? unit
            : q0.mul(c0).add(qty.mul(unit)).div(q1);

        await tx.stockItem.upsert({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: dto.warehouseId,
              productId: line.productId,
            },
          },
          create: {
            organizationId,
            warehouseId: dto.warehouseId,
            productId: line.productId,
            quantity: q1,
            averageCost: c1,
          },
          update: {
            quantity: q1,
            averageCost: c1,
          },
        });

        const noteParts = ["RECEIPT"];
        if (dto.basisTransactionId) {
          noteParts.push(`BASIS_TX:${dto.basisTransactionId}`);
        }

        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: dto.warehouseId,
            productId: line.productId,
            binId: line.binId ?? null,
            type: StockMovementType.IN,
            reason: StockMovementReason.RECEIPT,
            quantity: qty,
            price: unit,
            note: noteParts.join("|"),
            documentDate,
          },
        });
      }

      return { linesPosted: dto.lines.length };
    });
  }

  /** Закупка услуг: кредиторка 531, расход 731; без движений по складу. */
  private async recordServicePurchase(
    organizationId: string,
    dto: PurchaseStockDto,
    pricesIncludeVat: boolean,
  ) {
    const purchaseLines = dto.lines;
    if (!purchaseLines?.length) {
      throw new BadRequestException("At least one purchase line is required");
    }
    return this.prisma.$transaction(async (tx) => {
      const documentDate = dto.documentDate ? new Date(dto.documentDate) : new Date();
      if (Number.isNaN(documentDate.getTime())) {
        throw new BadRequestException("Invalid documentDate");
      }
      let totalNet = new Decimal(0);
      let totalVat = new Decimal(0);
      let totalGross = new Decimal(0);
      const snapshotLines: Array<{
        kind: "services";
        productId: string;
        quantity: number;
        productName: string;
        sku: string;
      }> = [];

      for (let lineIndex = 0; lineIndex < purchaseLines.length; lineIndex++) {
        const line = purchaseLines[lineIndex];
        const p = await tx.product.findFirst({
          where: { id: line.productId, organizationId },
        });
        if (!p) {
          throw new NotFoundException(`Product ${line.productId} not found`);
        }
        if (!p.isService) {
          throw new BadRequestException(
            `Строка ${lineIndex + 1}: для закупки услуг выберите номенклатуру-услугу (isService)`,
          );
        }
        snapshotLines.push({
          kind: "services",
          productId: line.productId,
          quantity: Number(line.quantity),
          productName: p.name,
          sku: typeof p.sku === "string" ? p.sku : String(p.sku ?? ""),
        });
        const qty = new Decimal(line.quantity);
        const grossUnit = new Decimal(line.unitPrice);
        const vatRate = this.purchaseLineVatRatePercent(line, p.vatRate);
        const netUnit = this.purchaseNetUnit(grossUnit, vatRate, pricesIncludeVat);
        const lineNet = qty.mul(netUnit);
        const lineGross = pricesIncludeVat ? qty.mul(grossUnit) : lineNet;
        const lineVat = lineGross.sub(lineNet);
        totalNet = totalNet.add(lineNet);
        totalVat = totalVat.add(lineVat);
        totalGross = totalGross.add(lineGross);
      }

      const cur = (dto.currency ?? "AZN").toUpperCase();
      let fx = new Decimal(dto.fxRateToAzn ?? 1);
      if (cur === "AZN") {
        fx = new Decimal(1);
      }
      if (fx.lte(0)) {
        throw new BadRequestException("fxRateToAzn must be greater than 0");
      }
      const nAz = totalNet.mul(fx);
      const vAz = totalVat.mul(fx);
      const gAz = totalGross.mul(fx);

      const journalLines =
        totalVat.gt(0) && pricesIncludeVat
          ? [
              {
                accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
                debit: nAz.toString(),
                credit: 0,
              },
              {
                accountCode: VAT_INPUT_ACCOUNT_CODE,
                debit: vAz.toString(),
                credit: 0,
              },
              {
                accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
                debit: 0,
                credit: gAz.toString(),
              },
            ]
          : [
              {
                accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
                debit: nAz.toString(),
                credit: 0,
              },
              {
                accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
                debit: 0,
                credit: gAz.toString(),
              },
            ];

      const journalRef = dto.reference?.trim() || "PURCHASE_INVOICE";
      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: documentDate,
        reference: journalRef,
        description: pricesIncludeVat
          ? `Alış fakturası — xidmətlər (${cur}, fx=${fx.toString()}, qiymətlər ƏDV daxil)`
          : `Alış fakturası — xidmətlər (${cur}, fx=${fx.toString()})`,
        counterpartyId: dto.counterpartyId ?? null,
        lines: journalLines,
      });
      await tx.transaction.update({
        where: { id: transactionId, organizationId },
        data: {
          purchaseSnapshot: { version: 1, lines: snapshotLines } as Prisma.InputJsonValue,
        },
      });

      return {
        totalAmount: totalGross.toString(),
        netAmount: totalNet.toString(),
        vatAmount: totalVat.toString(),
        lines: purchaseLines.length,
      };
    });
  }

  async transferStock(organizationId: string, dto: TransferStockDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException("Склады должны различаться");
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const fromW = await this.prisma.warehouse.findFirst({
      where: { id: dto.fromWarehouseId, organizationId },
    });
    const toW = await this.prisma.warehouse.findFirst({
      where: { id: dto.toWarehouseId, organizationId },
    });
    if (!fromW || !toW) throw new NotFoundException("Warehouse not found");

    const prod = await this.prisma.product.findFirst({
      where: { id: dto.productId, organizationId },
      select: { isService: true },
    });
    if (!prod) throw new NotFoundException("Product not found");
    if (prod.isService) {
      throw new BadRequestException("Service products cannot be transferred on stock");
    }

    const qty = new Decimal(dto.quantity);
    const batch = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const documentDate = new Date();
      await assertWarehouseNotUnderReconciliation(tx, organizationId, dto.fromWarehouseId);
      await assertWarehouseNotUnderReconciliation(tx, organizationId, dto.toWarehouseId);

      const src = await tx.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: dto.fromWarehouseId,
            productId: dto.productId,
          },
        },
      });
      const avail = src?.quantity ?? new Decimal(0);
      const avgFrom = src?.averageCost ?? new Decimal(0);
      if (avail.lt(qty)) {
        throw new BadRequestException("Недостаточно товара для перемещения");
      }

      const unitOut = await this.stock.computeIssueUnitCost(
        tx,
        organizationId,
        dto.fromWarehouseId,
        dto.productId,
        qty,
        avgFrom,
        avgFrom,
      );

      const qSrcNew = avail.sub(qty);
      await tx.stockItem.upsert({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: dto.fromWarehouseId,
            productId: dto.productId,
          },
        },
        create: {
          organizationId,
          warehouseId: dto.fromWarehouseId,
          productId: dto.productId,
          quantity: qSrcNew,
          averageCost: avgFrom,
        },
        update: {
          quantity: qSrcNew,
        },
      });

      const dst = await tx.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: dto.toWarehouseId,
            productId: dto.productId,
          },
        },
      });
      const qDst0 = dst?.quantity ?? new Decimal(0);
      const cDst0 = dst?.averageCost ?? new Decimal(0);
      const qDst1 = qDst0.add(qty);
      const cDst1 =
        qDst1.lte(0) ? new Decimal(0) : qDst0.lte(0)
          ? unitOut
          : qDst0.mul(cDst0).add(qty.mul(unitOut)).div(qDst1);

      await tx.stockItem.upsert({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: dto.toWarehouseId,
            productId: dto.productId,
          },
        },
        create: {
          organizationId,
          warehouseId: dto.toWarehouseId,
          productId: dto.productId,
          quantity: qDst1,
          averageCost: cDst1,
        },
        update: {
          quantity: qDst1,
          averageCost: cDst1,
        },
      });

      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: dto.fromWarehouseId,
          productId: dto.productId,
          type: StockMovementType.OUT,
          reason: StockMovementReason.ADJUSTMENT,
          quantity: qty,
          price: unitOut,
          transferBatchId: batch,
          note: "TRANSFER_OUT",
          documentDate,
        },
      });
      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: dto.toWarehouseId,
          productId: dto.productId,
          type: StockMovementType.IN,
          reason: StockMovementReason.ADJUSTMENT,
          quantity: qty,
          price: unitOut,
          transferBatchId: batch,
          note: "TRANSFER_IN",
          documentDate,
        },
      });

      return { transferBatchId: batch };
    });
  }

  /**
   * Available quantity by movement ledger for one warehouse + bin + product (matches Anbar qalığı).
   */
  private async movementBinAvailable(
    tx: Prisma.TransactionClient,
    organizationId: string,
    warehouseId: string,
    productId: string,
    binId: string | null,
  ): Promise<Decimal> {
    if (binId) {
      const rows = await tx.$queryRaw<Array<{ q: unknown }>>(
        Prisma.sql`
          SELECT
            COALESCE(SUM(CASE WHEN m.type::text = 'IN' THEN m.quantity ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN m.type::text = 'OUT' THEN m.quantity ELSE 0 END), 0) AS q
          FROM stock_movements m
          INNER JOIN products p ON p.id = m.product_id AND p.organization_id = m.organization_id
          WHERE m.organization_id = ${organizationId}::uuid
            AND m.warehouse_id = ${warehouseId}::uuid
            AND m.product_id = ${productId}::uuid
            AND m.bin_id = ${binId}::uuid
            AND p.is_service = false
        `,
      );
      return new Decimal(String(rows[0]?.q ?? 0));
    }
    const rows = await tx.$queryRaw<Array<{ q: unknown }>>(
      Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN m.type::text = 'IN' THEN m.quantity ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN m.type::text = 'OUT' THEN m.quantity ELSE 0 END), 0) AS q
        FROM stock_movements m
        INNER JOIN products p ON p.id = m.product_id AND p.organization_id = m.organization_id
        WHERE m.organization_id = ${organizationId}::uuid
          AND m.warehouse_id = ${warehouseId}::uuid
          AND m.product_id = ${productId}::uuid
          AND m.bin_id IS NULL
          AND p.is_service = false
      `,
    );
    return new Decimal(String(rows[0]?.q ?? 0));
  }

  private normalizeTransferLineBins(line: TransferLineDto): {
    sourceBinId: string | null;
    targetBinId: string | null;
  } {
    const s =
      line.sourceBinId != null && String(line.sourceBinId).trim() !== ""
        ? String(line.sourceBinId).trim()
        : null;
    const t =
      line.targetBinId != null && String(line.targetBinId).trim() !== ""
        ? String(line.targetBinId).trim()
        : null;
    return { sourceBinId: s, targetBinId: t };
  }

  /**
   * Yerdəyişmə: for each line, OUT from source warehouse/bin and IN to target warehouse/bin in one DB transaction.
   * Updates `StockItem` per warehouse (valuation unchanged from issue unit cost). No GL.
   */
  async recordInventoryTransfers(organizationId: string, dto: CreateTransferDto) {
    const documentDate = new Date(dto.date);
    if (Number.isNaN(documentDate.getTime())) {
      throw new BadRequestException("Invalid document date");
    }

    const lines = dto.lines;
    const binIds = new Set<string>();
    for (const line of lines) {
      const { sourceBinId, targetBinId } = this.normalizeTransferLineBins(line);
      if (sourceBinId) binIds.add(sourceBinId);
      if (targetBinId) binIds.add(targetBinId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (binIds.size > 0) {
        const bins = await tx.warehouseBin.findMany({
          where: { organizationId, id: { in: [...binIds] } },
          select: { id: true, warehouseId: true },
        });
        const binMap = new Map(bins.map((b) => [b.id, b]));
        for (const id of binIds) {
          if (!binMap.has(id)) {
            throw new NotFoundException(`Bin ${id} not found`);
          }
        }
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const { sourceBinId, targetBinId } = this.normalizeTransferLineBins(line);

        if (
          line.sourceWarehouseId === line.targetWarehouseId &&
          (sourceBinId ?? null) === (targetBinId ?? null)
        ) {
          throw new BadRequestException(
            `Line ${i + 1}: source and target warehouse/bin must differ`,
          );
        }

        const fromW = await tx.warehouse.findFirst({
          where: { id: line.sourceWarehouseId, organizationId },
          select: { id: true },
        });
        const toW = await tx.warehouse.findFirst({
          where: { id: line.targetWarehouseId, organizationId },
          select: { id: true },
        });
        if (!fromW || !toW) {
          throw new NotFoundException("Warehouse not found");
        }
        if (sourceBinId) {
          const b = await tx.warehouseBin.findFirst({
            where: { id: sourceBinId, organizationId },
            select: { warehouseId: true },
          });
          if (!b || b.warehouseId !== line.sourceWarehouseId) {
            throw new BadRequestException(
              `Line ${i + 1}: source bin does not belong to the source warehouse`,
            );
          }
        }
        if (targetBinId) {
          const b = await tx.warehouseBin.findFirst({
            where: { id: targetBinId, organizationId },
            select: { warehouseId: true },
          });
          if (!b || b.warehouseId !== line.targetWarehouseId) {
            throw new BadRequestException(
              `Line ${i + 1}: target bin does not belong to the target warehouse`,
            );
          }
        }

        const prod = await tx.product.findFirst({
          where: { id: line.productId, organizationId },
          select: { isService: true },
        });
        if (!prod) {
          throw new NotFoundException(`Product ${line.productId} not found`);
        }
        if (prod.isService) {
          throw new BadRequestException(`Line ${i + 1}: service products cannot be transferred`);
        }

        const qty = new Decimal(line.quantity);
        const availBin = await this.movementBinAvailable(
          tx,
          organizationId,
          line.sourceWarehouseId,
          line.productId,
          sourceBinId,
        );
        if (availBin.lt(qty)) {
          throw new BadRequestException(
            `Line ${i + 1}: insufficient quantity at source warehouse/bin for this product`,
          );
        }
      }

      const whIds = new Set<string>();
      for (const line of lines) {
        whIds.add(line.sourceWarehouseId);
        whIds.add(line.targetWarehouseId);
      }
      for (const wid of whIds) {
        await assertWarehouseNotUnderReconciliation(tx, organizationId, wid);
      }

      const docBatch = randomUUID();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const { sourceBinId, targetBinId } = this.normalizeTransferLineBins(line);
        const qty = new Decimal(line.quantity);

        const src = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: line.sourceWarehouseId,
              productId: line.productId,
            },
          },
        });
        const availWh = src?.quantity ?? new Decimal(0);
        const avgFrom = src?.averageCost ?? new Decimal(0);
        if (availWh.lt(qty)) {
          throw new BadRequestException(
            `Line ${i + 1}: insufficient warehouse-level stock for this product`,
          );
        }

        const unitOut = await this.stock.computeIssueUnitCost(
          tx,
          organizationId,
          line.sourceWarehouseId,
          line.productId,
          qty,
          avgFrom,
          avgFrom,
        );

        const qSrcNew = availWh.sub(qty);
        await tx.stockItem.upsert({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: line.sourceWarehouseId,
              productId: line.productId,
            },
          },
          create: {
            organizationId,
            warehouseId: line.sourceWarehouseId,
            productId: line.productId,
            quantity: qSrcNew,
            averageCost: avgFrom,
          },
          update: {
            quantity: qSrcNew,
          },
        });

        const dst = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: line.targetWarehouseId,
              productId: line.productId,
            },
          },
        });
        const qDst0 = dst?.quantity ?? new Decimal(0);
        const cDst0 = dst?.averageCost ?? new Decimal(0);
        const qDst1 = qDst0.add(qty);
        const cDst1 =
          qDst1.lte(0)
            ? new Decimal(0)
            : qDst0.lte(0)
              ? unitOut
              : qDst0.mul(cDst0).add(qty.mul(unitOut)).div(qDst1);

        await tx.stockItem.upsert({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: line.targetWarehouseId,
              productId: line.productId,
            },
          },
          create: {
            organizationId,
            warehouseId: line.targetWarehouseId,
            productId: line.productId,
            quantity: qDst1,
            averageCost: cDst1,
          },
          update: {
            quantity: qDst1,
            averageCost: cDst1,
          },
        });

        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: line.sourceWarehouseId,
            productId: line.productId,
            binId: sourceBinId,
            type: StockMovementType.OUT,
            reason: StockMovementReason.TRANSFER,
            quantity: qty,
            price: unitOut,
            transferBatchId: docBatch,
            note: "TRANSFER_OUT",
            documentDate,
          },
        });
        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: line.targetWarehouseId,
            productId: line.productId,
            binId: targetBinId,
            type: StockMovementType.IN,
            reason: StockMovementReason.TRANSFER,
            quantity: qty,
            price: unitOut,
            transferBatchId: docBatch,
            note: "TRANSFER_IN",
            documentDate,
          },
        });
      }

      return { transferBatchId: docBatch, linesPosted: lines.length };
    });
  }

  /**
   * Списание по продаже + Дт 701 Кт 201 в той же транзакции, что и признание выручки (отгрузка / оплата).
   */
  async postSaleInventoryInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    invoiceId: string,
  ): Promise<void> {
    const inv = await tx.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: { items: true },
    });
    if (!inv) throw new NotFoundException("Invoice not found");
    if (inv.inventorySettled) return;

    const saleDocumentDate = inv.recognizedAt ?? inv.createdAt;

    const lines = inv.items.filter((i) => i.productId != null);
    if (lines.length === 0) {
      await tx.invoice.update({
        where: { id: inv.id },
        data: { inventorySettled: true },
      });
      return;
    }

    const whId =
      inv.warehouseId ??
      (await this.resolveDefaultWarehouseIdInTx(tx, organizationId));
    if (!whId) {
      await tx.invoice.update({
        where: { id: inv.id },
        data: { inventorySettled: true },
      });
      return;
    }

    await assertWarehouseNotUnderReconciliation(tx, organizationId, whId);

    let totalCogs = new Decimal(0);

    for (const line of lines) {
      const pid = line.productId as string;
      const need = line.quantity;

      const prod = await tx.product.findFirst({
        where: { id: pid, organizationId },
        select: { isService: true },
      });
      if (prod?.isService) {
        continue;
      }

      const si = await tx.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: whId,
            productId: pid,
          },
        },
      });
      const avail = si?.quantity ?? new Decimal(0);
      const avg = si?.averageCost ?? new Decimal(0);
      const fallbackPrice = new Decimal(line.unitPrice);
      const unitCost = await this.stock.computeIssueUnitCost(
        tx,
        organizationId,
        whId,
        pid,
        need,
        avg,
        fallbackPrice.gt(0) ? fallbackPrice : avg,
      );

      if (avail.lt(need)) {
        throw new BadRequestException(
          `Недостаточно товара на складе для отгрузки по счёту (product ${pid})`,
        );
      }

      const lineCogs = need.mul(unitCost);
      totalCogs = totalCogs.add(lineCogs);
      const newQty = avail.sub(need);

      await tx.stockItem.upsert({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: whId,
            productId: pid,
          },
        },
        create: {
          organizationId,
          warehouseId: whId,
          productId: pid,
          quantity: newQty,
          averageCost: unitCost,
        },
        update: {
          quantity: newQty,
        },
      });

      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: whId,
          productId: pid,
          type: StockMovementType.OUT,
          reason: StockMovementReason.SALE,
          quantity: need,
          price: unitCost,
          invoiceId: inv.id,
          documentDate: saleDocumentDate,
        },
      });
    }

    if (totalCogs.gt(0)) {
      await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: saleDocumentDate,
        reference: inv.number,
        description: `Себестоимость по инвойсу ${inv.number}`,
        lines: [
          {
            accountCode: COGS_ACCOUNT_CODE,
            debit: totalCogs.toString(),
            credit: 0,
          },
          {
            accountCode: INVENTORY_GOODS_ACCOUNT_CODE,
            debit: 0,
            credit: totalCogs.toString(),
          },
        ],
      });
    }

    await tx.invoice.update({
      where: { id: inv.id },
      data: { inventorySettled: true },
    });
  }

  /**
   * Корректировка остатков внутри уже открытой транзакции (инвентаризация и др.).
   */
  async adjustStockInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    dto: AdjustStockDto,
  ): Promise<{ type: "IN" | "OUT"; amount: string }> {
    const documentDate = new Date();
    const qty = new Decimal(dto.quantity);
    const wh = await tx.warehouse.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });
    if (!wh) throw new NotFoundException("Warehouse not found");

    await assertWarehouseNotUnderReconciliation(tx, organizationId, dto.warehouseId);

    const product = await tx.product.findFirst({
      where: { id: dto.productId, organizationId },
    });
    if (!product) throw new NotFoundException("Product not found");
    if (product.isService) {
      throw new BadRequestException("Service products cannot be adjusted on stock");
    }

    const org = await tx.organization.findUnique({
      where: { id: organizationId },
    });
    const allowNeg = !!parseInventorySettings(org?.settings).allowNegativeStock;

    const invAccountCode =
      dto.inventoryAccountCode === "204"
        ? FINISHED_GOODS_ACCOUNT_CODE
        : INVENTORY_GOODS_ACCOUNT_CODE;

    const existing = await tx.stockItem.findUnique({
      where: {
        organizationId_warehouseId_productId: {
          organizationId,
          warehouseId: dto.warehouseId,
          productId: dto.productId,
        },
      },
    });

    if (dto.type === "OUT") {
      const avail = existing?.quantity ?? new Decimal(0);
      const avg = existing?.averageCost ?? new Decimal(0);
      if (avail.lt(qty) && !allowNeg) {
        throw new BadRequestException("Недостаточно товара для списания");
      }
      const unit = await this.stock.computeIssueUnitCost(
        tx,
        organizationId,
        dto.warehouseId,
        dto.productId,
        qty,
        avg,
        avg,
      );
      const amount = qty.mul(unit);
      const qNew = avail.sub(qty);

      await tx.stockItem.upsert({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: dto.warehouseId,
            productId: dto.productId,
          },
        },
        create: {
          organizationId,
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          quantity: qNew,
          averageCost: unit,
        },
        update: {
          quantity: qNew,
        },
      });

      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          type: StockMovementType.OUT,
          reason: StockMovementReason.ADJUSTMENT,
          quantity: qty,
          price: unit,
          note: "INV_ADJ_OUT",
          documentDate,
        },
      });

      if (amount.gt(0)) {
        await this.accounting.postJournalInTransaction(tx, {
          organizationId,
          date: documentDate,
          reference: "INV-ADJ-OUT",
          description: `Списание запасов (${invAccountCode})`,
          isFinal: true,
          lines: [
            {
              accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
              debit: amount.toString(),
              credit: 0,
            },
            {
              accountCode: invAccountCode,
              debit: 0,
              credit: amount.toString(),
            },
          ],
        });
      }

      return { type: "OUT" as const, amount: amount.toString() };
    }

    const unit =
      dto.unitPrice != null ? new Decimal(dto.unitPrice) : new Decimal(0);
    if (unit.lt(0)) {
      throw new BadRequestException("Укажите цену за единицу (≥ 0) при оприходовании");
    }

    const q0 = existing?.quantity ?? new Decimal(0);
    const c0 = existing?.averageCost ?? new Decimal(0);
    const q1 = q0.add(qty);
    const c1 = q1.lte(0)
      ? new Decimal(0)
      : q0.lte(0)
        ? unit
        : q0.mul(c0).add(qty.mul(unit)).div(q1);

    await tx.stockItem.upsert({
      where: {
        organizationId_warehouseId_productId: {
          organizationId,
          warehouseId: dto.warehouseId,
          productId: dto.productId,
        },
      },
      create: {
        organizationId,
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        quantity: q1,
        averageCost: c1,
      },
      update: {
        quantity: q1,
        averageCost: c1,
      },
    });

    await tx.stockMovement.create({
      data: {
        organizationId,
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        type: StockMovementType.IN,
        reason: StockMovementReason.ADJUSTMENT,
        quantity: qty,
        price: unit,
        note: "INV_ADJ_IN",
        documentDate,
      },
    });

    const amount = qty.mul(unit);
    if (amount.gt(0)) {
      await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: documentDate,
        reference: "INV-ADJ-IN",
        description: `Оприходование излишков (${invAccountCode})`,
        isFinal: true,
        lines: [
          {
            accountCode: invAccountCode,
            debit: amount.toString(),
            credit: 0,
          },
          {
            accountCode: INVENTORY_SURPLUS_INCOME_ACCOUNT_CODE,
            debit: 0,
            credit: amount.toString(),
          },
        ],
      });
    }

    return { type: "IN" as const, amount: amount.toString() };
  }

  /**
   * Корректировка остатков: списание (Дт 731 — Кт 201/204) или оприходование излишков (Дт 201/204 — Кт 631).
   */
  async adjustStock(
    organizationId: string,
    dto: AdjustStockDto,
    actingUserRole?: UserRole,
  ) {
    if (actingUserRole !== undefined) {
      assertMayPostManualJournal(actingUserRole);
    }
    return this.prisma.$transaction((tx) =>
      this.adjustStockInTransaction(tx, organizationId, dto),
    );
  }

  async listInventoryAdjustments(
    organizationId: string,
    warehouseId?: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where = {
      organizationId,
      ...(warehouseId ? { warehouseId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.inventoryAdjustment.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          warehouse: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryAdjustment.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getInventoryAdjustment(organizationId: string, id: string) {
    const row = await this.prisma.inventoryAdjustment.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: {
          select: { id: true, name: true, inventoryAccountCode: true },
        },
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { id: true, name: true, sku: true, isService: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException("Inventory adjustment not found");
    }
    return row;
  }

  async createInventoryAdjustment(
    organizationId: string,
    dto: CreateInventoryAdjustmentDto,
  ) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, organizationId },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException("Warehouse not found");

    const productIds = dto.lines.map((l) => l.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException("Duplicate productId in lines");
    }

    const products = await this.prisma.product.findMany({
      where: { organizationId, id: { in: productIds } },
      select: { id: true, isService: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException("One or more products not found");
    }
    if (products.some((p) => p.isService)) {
      throw new BadRequestException("Service products cannot be adjusted on stock");
    }

    const date = new Date(dto.date);

    return this.prisma.$transaction(async (tx) => {
      const lineCreates: Prisma.InventoryAdjustmentLineCreateWithoutAdjustmentInput[] =
        [];

      for (const line of dto.lines) {
        const stock = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: dto.warehouseId,
              productId: line.productId,
            },
          },
          select: { quantity: true },
        });
        const expected = stock?.quantity ?? new Decimal(0);
        const actual = new Decimal(line.actualQuantity);
        const delta = actual.sub(expected);
        const unitCost =
          line.unitCost != null ? new Decimal(line.unitCost) : new Decimal(0);
        if (unitCost.lt(0)) {
          throw new BadRequestException("unitCost must be >= 0");
        }
        lineCreates.push({
          product: { connect: { id: line.productId } },
          expectedQuantity: expected,
          actualQuantity: actual,
          deltaQuantity: delta,
          unitCost,
        });
      }

      return tx.inventoryAdjustment.create({
        data: {
          organization: { connect: { id: organizationId } },
          warehouse: { connect: { id: dto.warehouseId } },
          date,
          status: InventoryAdjustmentStatus.DRAFT,
          reason: dto.reason?.trim() ?? "",
          docType: dto.docType,
          lines: { create: lineCreates },
        },
        include: {
          warehouse: {
            select: { id: true, name: true, inventoryAccountCode: true },
          },
          lines: {
            orderBy: { createdAt: "asc" },
            include: {
              product: { select: { id: true, name: true, sku: true, isService: true } },
            },
          },
        },
      });
    });
  }

  /**
   * Проведение документа физической инвентаризации / списания / оприходования:
   * движения склада + одна сводная проводка (731/201 при недостаче, 201/631 при излишке).
   * Списание по FIFO: {@link StockService.computeIssueUnitCost}.
   */
  async postAdjustment(
    organizationId: string,
    id: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ) {
    assertMayPostManualJournal(actingUserRole);
    await this.access.assertMayPostAccounting(actingUserId, organizationId);

    const draft = await this.prisma.inventoryAdjustment.findFirst({
      where: { id, organizationId, status: InventoryAdjustmentStatus.DRAFT },
      include: {
        warehouse: {
          select: { id: true, name: true, inventoryAccountCode: true },
        },
        lines: {
          include: {
            product: { select: { id: true, isService: true } },
          },
        },
      },
    });
    if (!draft) {
      throw new NotFoundException("Draft inventory adjustment not found");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const closed = getClosedPeriodKeys(org?.settings);
    const periodKey = monthKeyUtc(draft.date);
    if (closed.includes(periodKey)) {
      throw new BadRequestException(
        `Период ${periodKey} закрыт: проведение документа недоступно`,
      );
    }

    return this.prisma.$transaction((tx) =>
      this.postAdjustmentInTransaction(tx, organizationId, draft),
    );
  }

  private async postAdjustmentInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    draft: {
      id: string;
      date: Date;
      warehouseId: string;
      docType: InventoryAdjustmentDocType;
      warehouse: { id: string; name: string; inventoryAccountCode: string };
      lines: Array<{
        id: string;
        productId: string;
        actualQuantity: Decimal;
        product: { isService: boolean };
      }>;
    },
  ) {
    const documentDate = new Date(
      Date.UTC(
        draft.date.getUTCFullYear(),
        draft.date.getUTCMonth(),
        draft.date.getUTCDate(),
        12,
        0,
        0,
        0,
      ),
    );

    await assertWarehouseNotUnderReconciliation(tx, organizationId, draft.warehouseId);

    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const allowNeg = !!parseInventorySettings(org?.settings).allowNegativeStock;

    const invAcc =
      draft.warehouse.inventoryAccountCode === "204"
        ? FINISHED_GOODS_ACCOUNT_CODE
        : INVENTORY_GOODS_ACCOUNT_CODE;

    const eps = new Decimal("0.0001");
    let surplusTotal = new Decimal(0);
    let shortageTotal = new Decimal(0);

    type WorkLine = {
      lineId: string;
      productId: string;
      expected: Decimal;
      actual: Decimal;
      delta: Decimal;
    };

    const work: WorkLine[] = [];

    for (const line of draft.lines) {
      if (line.product.isService) {
        throw new BadRequestException(
          `Product ${line.productId} is a service; remove from document`,
        );
      }
      const existing = await tx.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: draft.warehouseId,
            productId: line.productId,
          },
        },
      });
      const expected = existing?.quantity ?? new Decimal(0);
      const actual = new Decimal(line.actualQuantity ?? 0);
      if (actual.lt(0)) {
        throw new BadRequestException("actualQuantity must be >= 0");
      }
      const delta = actual.sub(expected);
      work.push({ lineId: line.id, productId: line.productId, expected, actual, delta });
    }

    if (draft.docType === InventoryAdjustmentDocType.WRITE_OFF) {
      if (work.some((w) => w.delta.gt(eps))) {
        throw new BadRequestException(
          "WRITE_OFF: все строки должны иметь разницу ≤ 0 (только недостача)",
        );
      }
    }
    if (draft.docType === InventoryAdjustmentDocType.SURPLUS) {
      if (work.some((w) => w.delta.lt(eps.neg()))) {
        throw new BadRequestException(
          "SURPLUS: все строки должны иметь разницу ≥ 0 (только излишек)",
        );
      }
    }

    for (const w of work) {
      if (w.delta.abs().lt(eps)) {
        await tx.inventoryAdjustmentLine.update({
          where: { id: w.lineId },
          data: {
            expectedQuantity: w.expected,
            actualQuantity: w.actual,
            deltaQuantity: w.delta,
            unitCost: new Decimal(0),
          },
        });
        continue;
      }

      if (w.delta.gt(0)) {
        const qtyAbs = w.delta;
        const existing = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: draft.warehouseId,
              productId: w.productId,
            },
          },
        });
        const q0 = existing?.quantity ?? new Decimal(0);
        const c0 = existing?.averageCost ?? new Decimal(0);
        const lineRow = await tx.inventoryAdjustmentLine.findUnique({
          where: { id: w.lineId },
          select: { unitCost: true },
        });
        const inputUnit =
          lineRow?.unitCost && new Decimal(lineRow.unitCost).gt(0)
            ? new Decimal(lineRow.unitCost)
            : c0;
        const amount = qtyAbs.mul(inputUnit);
        surplusTotal = surplusTotal.add(amount);

        const q1 = q0.add(qtyAbs);
        const c1 =
          q1.lte(0)
            ? new Decimal(0)
            : q0.lte(0)
              ? inputUnit
              : q0.mul(c0).add(qtyAbs.mul(inputUnit)).div(q1);

        await tx.stockItem.upsert({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: draft.warehouseId,
              productId: w.productId,
            },
          },
          create: {
            organizationId,
            warehouseId: draft.warehouseId,
            productId: w.productId,
            quantity: q1,
            averageCost: c1,
          },
          update: {
            quantity: q1,
            averageCost: c1,
          },
        });

        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: draft.warehouseId,
            productId: w.productId,
            type: StockMovementType.IN,
            reason: StockMovementReason.ADJUSTMENT,
            quantity: qtyAbs,
            price: inputUnit,
            note: `INV_PHYS:${draft.id}`,
            documentDate,
          },
        });

        await tx.inventoryAdjustmentLine.update({
          where: { id: w.lineId },
          data: {
            expectedQuantity: w.expected,
            actualQuantity: w.actual,
            deltaQuantity: w.delta,
            unitCost: inputUnit,
          },
        });
      } else {
        const qtyAbs = w.delta.abs();
        const existing = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: draft.warehouseId,
              productId: w.productId,
            },
          },
        });
        const avail = existing?.quantity ?? new Decimal(0);
        const avg = existing?.averageCost ?? new Decimal(0);
        if (avail.lt(qtyAbs) && !allowNeg) {
          throw new BadRequestException(
            `Недостаточно товара для списания (product ${w.productId})`,
          );
        }
        const unit = await this.stock.computeIssueUnitCost(
          tx,
          organizationId,
          draft.warehouseId,
          w.productId,
          qtyAbs,
          avg,
          avg,
        );
        const amount = qtyAbs.mul(unit);
        shortageTotal = shortageTotal.add(amount);

        const qNew = avail.sub(qtyAbs);

        await tx.stockItem.upsert({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: draft.warehouseId,
              productId: w.productId,
            },
          },
          create: {
            organizationId,
            warehouseId: draft.warehouseId,
            productId: w.productId,
            quantity: qNew,
            averageCost: unit,
          },
          update: {
            quantity: qNew,
          },
        });

        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: draft.warehouseId,
            productId: w.productId,
            type: StockMovementType.OUT,
            reason: StockMovementReason.ADJUSTMENT,
            quantity: qtyAbs,
            price: unit,
            note: `INV_PHYS:${draft.id}`,
            documentDate,
          },
        });

        await tx.inventoryAdjustmentLine.update({
          where: { id: w.lineId },
          data: {
            expectedQuantity: w.expected,
            actualQuantity: w.actual,
            deltaQuantity: w.delta,
            unitCost: unit,
          },
        });
      }
    }

    const glLines: Array<{
      accountCode: string;
      debit: string | number;
      credit: string | number;
    }> = [
      ...(surplusTotal.gt(0)
        ? [
            { accountCode: invAcc, debit: surplusTotal.toString(), credit: 0 },
            {
              accountCode: INVENTORY_SURPLUS_INCOME_ACCOUNT_CODE,
              debit: 0,
              credit: surplusTotal.toString(),
            },
          ]
        : []),
      ...(shortageTotal.gt(0)
        ? [
            {
              accountCode: MISC_OPERATING_EXPENSE_ACCOUNT_CODE,
              debit: shortageTotal.toString(),
              credit: 0,
            },
            { accountCode: invAcc, debit: 0, credit: shortageTotal.toString() },
          ]
        : []),
    ];

    if (glLines.length) {
      await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: documentDate,
        reference: `INV-PHYS-${draft.id}`,
        description: `Инвентаризация / корректировка остатков (${draft.warehouse.name})`,
        isFinal: true,
        lines: glLines,
      });
    }

    await tx.inventoryAdjustment.update({
      where: { id: draft.id },
      data: { status: InventoryAdjustmentStatus.POSTED },
    });

    return tx.inventoryAdjustment.findFirstOrThrow({
      where: { id: draft.id, organizationId },
      include: {
        warehouse: {
          select: { id: true, name: true, inventoryAccountCode: true },
        },
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { id: true, name: true, sku: true, isService: true } },
          },
        },
      },
    });
  }

  private async resolveDefaultWarehouseIdInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<string | null> {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
    });
    const parsed = parseInventorySettings(org?.settings);
    if (parsed.defaultWarehouseId) {
      const w = await tx.warehouse.findFirst({
        where: { id: parsed.defaultWarehouseId, organizationId },
      });
      if (w) return w.id;
    }
    const first = await tx.warehouse.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    return first?.id ?? null;
  }
}
