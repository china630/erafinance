import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
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
import {
  StockMovementReason,
  StockMovementType,
  UserRole,
} from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { CreateWarehouseBinDto } from "./dto/create-warehouse-bin.dto";
import { PatchInventorySettingsDto } from "./dto/patch-inventory-settings.dto";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { CreateInventoryAdjustmentDto } from "./dto/create-inventory-adjustment.dto";
import { PurchaseStockDto } from "./dto/purchase-stock.dto";
import { CreateWarehouseReceiptDto } from "./dto/create-warehouse-receipt.dto";
import { CreateWarehouseShipmentDto } from "./dto/create-warehouse-shipment.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { SurplusStockDocumentDto } from "./dto/surplus-stock-document.dto";
import { TransferStockDto } from "./dto/transfer-stock.dto";
import { WriteOffStockDocumentDto } from "./dto/write-off-stock-document.dto";
import { InventoryService } from "./inventory.service";

@ApiTags("inventory")
@ApiBearerAuth("bearer")
@Controller("inventory")
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("settings")
  @ApiOperation({ summary: "Настройки склада (минус, склад по умолчанию)" })
  settings(@OrganizationId() organizationId: string) {
    return this.inventory.getInventorySettings(organizationId);
  }

  @Patch("settings")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Обновить настройки склада в organization.settings" })
  patchSettings(
    @OrganizationId() organizationId: string,
    @Body() dto: PatchInventorySettingsDto,
  ) {
    return this.inventory.patchInventorySettings(organizationId, dto);
  }

  @Get("warehouses")
  warehouses(@OrganizationId() organizationId: string) {
    return this.inventory.listWarehouses(organizationId);
  }

  @Post("warehouses")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Создать склад" })
  createWarehouse(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.inventory.createWarehouse(organizationId, dto);
  }

  @Get("bins")
  @ApiOperation({ summary: "Список ячеек (топология склада)" })
  bins(
    @OrganizationId() organizationId: string,
    @Query("warehouseId") warehouseId?: string,
  ) {
    return this.inventory.listBins(organizationId, warehouseId);
  }

  @Post("bins")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Создать ячейку склада" })
  createBin(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateWarehouseBinDto,
  ) {
    return this.inventory.createBin(organizationId, dto);
  }

  @Get("stock")
  @ApiOperation({ summary: "Остатки по складам" })
  stock(
    @OrganizationId() organizationId: string,
    @Query("warehouseId") warehouseId?: string,
  ) {
    return this.inventory.listStock(organizationId, warehouseId);
  }

  @Get("balances")
  @ApiOperation({
    summary:
      "Anbar qalığı: остатки из stock_movements (SUM(IN)−SUM(OUT)) по складу, ячейке, товару; qty>0",
  })
  balances(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
    @Query("warehouseId") warehouseId?: string,
    @Query("search") search?: string,
  ) {
    return this.inventory.listMovementBalances(organizationId, {
      warehouseId: warehouseId || undefined,
      search: search?.trim() || undefined,
      page,
      pageSize,
    });
  }

  @Get("purchase-invoices")
  @ApiOperation({
    summary:
      "Реестр alış fakturası (проводки 201/731+241+531), без складских строк",
  })
  purchaseInvoices(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.inventory.listPurchaseInvoices(organizationId, { page, pageSize });
  }

  @Get("purchase-invoices/:id")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.WAREHOUSE_KEEPER,
  )
  @ApiOperation({
    summary:
      "Alış fakturası по id: строки из purchaseSnapshot (для автозаполнения mədaxil orderi)",
  })
  purchaseInvoiceDetail(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.inventory.getPurchaseInvoiceDetail(organizationId, id);
  }

  @Get("sales-invoices")
  @ApiOperation({
    summary:
      "Реестр Satış fakturası (проводки Дт 211 — Кт 601) для основания məxaric orderi",
  })
  salesInvoices(
    @OrganizationId() organizationId: string,
    @Query("take") take?: string,
  ) {
    return this.inventory.listSalesInvoices(
      organizationId,
      take ? Number.parseInt(take, 10) : 400,
    );
  }

  @Get("sales-invoices/:id")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.WAREHOUSE_KEEPER,
  )
  @ApiOperation({
    summary:
      "Satış по id транзакции выручки: строки из salesSnapshot (автозаполнение məxaric orderi)",
  })
  salesInvoiceDetail(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.inventory.getSalesInvoiceDetail(organizationId, id);
  }

  @Get("movements")
  @ApiOperation({ summary: "История движений" })
  movements(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
    @Query("warehouseId") warehouseId?: string,
    @Query("productId") productId?: string,
    @Query("note") note?: string,
    @Query("notes") notesCsv?: string,
    @Query("type") type?: string,
    @Query("reason") reason?: string,
  ) {
    const notes =
      notesCsv
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? undefined;
    const typeParsed =
      type && Object.values(StockMovementType).includes(type as StockMovementType)
        ? (type as StockMovementType)
        : undefined;
    const reasonParsed =
      reason &&
      Object.values(StockMovementReason).includes(reason as StockMovementReason)
        ? (reason as StockMovementReason)
        : undefined;
    return this.inventory.listMovements(organizationId, {
      warehouseId: warehouseId || undefined,
      productId: productId || undefined,
      page,
      pageSize,
      note: note?.trim() || undefined,
      notes: notes && notes.length > 0 ? notes : undefined,
      type: typeParsed,
      reason: reasonParsed,
    });
  }

  @Post("purchase")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Alış fakturası: kind=goods — Дт 201 (+241 при ценах с НДС) Кт 531 без StockMovement; kind=services — Дт 731 (+241) Кт 531. Складской приход — отдельный документ (roadmap).",
  })
  purchase(
    @OrganizationId() organizationId: string,
    @Body() dto: PurchaseStockDto,
  ) {
    return this.inventory.recordPurchase(organizationId, dto);
  }

  @Post("receipts")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.WAREHOUSE_KEEPER,
  )
  @ApiOperation({
    summary:
      "Anbar mədaxil orderi: физический приход (StockMovement IN, RECEIPT), без проводок; опционально basisTransactionId или referenceId (alış fakturası); строки — lines или items",
  })
  warehouseReceipt(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateWarehouseReceiptDto,
  ) {
    return this.inventory.recordWarehouseReceipt(organizationId, dto);
  }

  @Post("shipments")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.WAREHOUSE_KEEPER,
  )
  @ApiOperation({
    summary:
      "Anbar məxarici orderi: StockMovement OUT (SHIPMENT) + COGS 701/201 при привязке к Satış; строки — lines или items",
  })
  warehouseShipment(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateWarehouseShipmentDto,
  ) {
    return this.inventory.recordWarehouseShipment(organizationId, dto);
  }

  @Post("transfer")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Перемещение между складами" })
  transfer(
    @OrganizationId() organizationId: string,
    @Body() dto: TransferStockDto,
  ) {
    return this.inventory.transferStock(organizationId, dto);
  }

  @Post("transfers")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.WAREHOUSE_KEEPER,
  )
  @ApiOperation({
    summary:
      "Yerdəyişmə: internal transfer — paired StockMovement OUT (source) + IN (target) per line, one DB transaction",
  })
  transfers(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.inventory.recordInventoryTransfers(organizationId, dto);
  }

  @Post("adjustments")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Корректировка: списание (Дт 731 — Кт 201/204) или оприходование (Дт 201/204 — Кт 631)",
  })
  adjustments(
    @OrganizationId() organizationId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.adjustStock(organizationId, dto, requireOrgRole(user));
  }

  @Post("documents/surplus")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Документ: оприходование излишков" })
  surplusDocument(
    @OrganizationId() organizationId: string,
    @Body() dto: SurplusStockDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.adjustStock(
      organizationId,
      {
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        quantity: dto.quantity,
        type: "IN",
        inventoryAccountCode: dto.inventoryAccountCode,
        unitPrice: dto.unitPrice,
      },
      requireOrgRole(user),
    );
  }

  @Get("physical-adjustments")
  @ApiOperation({
    summary:
      "Список документов физической инвентаризации / актов корректировки остатков",
  })
  listPhysicalAdjustments(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
    @Query("warehouseId") warehouseId?: string,
  ) {
    return this.inventory.listInventoryAdjustments(
      organizationId,
      warehouseId || undefined,
      { page, pageSize },
    );
  }

  @Get("physical-adjustments/:id")
  @ApiOperation({ summary: "Документ корректировки по id" })
  getPhysicalAdjustment(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.inventory.getInventoryAdjustment(organizationId, id);
  }

  @Post("physical-adjustments")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Черновик: ожидаемое количество из StockItem, факт из тела, delta = факт − учёт",
  })
  createPhysicalAdjustment(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateInventoryAdjustmentDto,
  ) {
    return this.inventory.createInventoryAdjustment(organizationId, dto);
  }

  @Post("physical-adjustments/:id/post")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Провести документ: движения склада + проводки 731/201 (недостача), 201/631 (излишек); списание по FIFO",
  })
  postPhysicalAdjustment(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.postAdjustment(
      organizationId,
      id,
      user.userId,
      requireOrgRole(user),
    );
  }

  @Post("documents/write-off")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Документ: списание товаров" })
  writeOffDocument(
    @OrganizationId() organizationId: string,
    @Body() dto: WriteOffStockDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.adjustStock(
      organizationId,
      {
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        quantity: dto.quantity,
        type: "OUT",
        inventoryAccountCode: dto.inventoryAccountCode,
      },
      requireOrgRole(user),
    );
  }
}
