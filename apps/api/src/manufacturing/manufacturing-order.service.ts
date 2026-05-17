import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Decimal,
  ManufacturingOrderStatus,
  Prisma,
  StockMovementReason,
  StockMovementType,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import {
  FINISHED_GOODS_ACCOUNT_CODE,
  INVENTORY_GOODS_ACCOUNT_CODE,
  WIP_MANUFACTURING_ACCOUNT_CODE,
} from "../ledger.constants";
import { PrismaService } from "../prisma/prisma.service";
import { assertWarehouseNotUnderReconciliation } from "../inventory/inventory-reconciliation-lock";
import { StockService } from "../stock/stock.service";
import { roundMoney2 } from "../fixed-assets/decimal-round";
import { normalizeListPagination } from "../common/list-pagination";
import { CreateManufacturingOrderDto } from "./dto/create-manufacturing-order.dto";

const orderInclude = {
  recipe: { include: { finishedProduct: true, lines: true, byproducts: true } },
  warehouse: true,
  lines: { include: { product: true } },
  release: true,
} as const;

@Injectable()
export class ManufacturingOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly stock: StockService,
  ) {}

  async listOrders(
    organizationId: string,
    opts?: { status?: ManufacturingOrderStatus; page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip } = normalizeListPagination(
      opts?.page,
      opts?.pageSize,
      25,
    );
    const where: Prisma.ManufacturingOrderWhereInput = {
      organizationId,
      ...(opts?.status ? { status: opts.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.manufacturingOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.manufacturingOrder.count({ where }),
    ]);
    return {
      items: rows.map((o) => this.mapOrderListItem(o)),
      total,
      page,
      pageSize,
    };
  }

  private mapOrderListItem(
    o: Prisma.ManufacturingOrderGetPayload<{ include: typeof orderInclude }>,
  ) {
    const recipeName =
      o.recipe.name?.trim() ||
      o.recipe.finishedProduct?.name ||
      o.recipe.finishedProductId;
    return {
      id: o.id,
      status: o.status,
      quantity: o.quantity.toString(),
      materialCost: o.materialCost.toString(),
      recipeName,
      warehouseName: o.warehouse.name,
      createdAt: o.createdAt.toISOString(),
      startedAt: o.startedAt?.toISOString() ?? null,
      completedAt: o.completedAt?.toISOString() ?? null,
    };
  }

  async countInProgress(organizationId: string): Promise<number> {
    return this.prisma.manufacturingOrder.count({
      where: {
        organizationId,
        status: ManufacturingOrderStatus.IN_PROGRESS,
      },
    });
  }

  async createOrder(organizationId: string, dto: CreateManufacturingOrderDto) {
    const wh = await this.resolveWarehouse(organizationId, dto.warehouseId);
    const recipe = await this.prisma.productRecipe.findFirst({
      where: { id: dto.recipeId, organizationId, deletedAt: null },
      include: { lines: true },
    });
    if (!recipe || recipe.lines.length === 0) {
      throw new BadRequestException("Recipe not found or has no components");
    }
    const qty = new Decimal(dto.quantity);
    if (qty.lte(0)) {
      throw new BadRequestException("quantity must be positive");
    }

    return this.prisma.manufacturingOrder.create({
      data: {
        organizationId,
        recipeId: recipe.id,
        warehouseId: wh.id,
        quantity: qty,
        status: ManufacturingOrderStatus.DRAFT,
      },
      include: orderInclude,
    });
  }

  async startOrder(organizationId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.manufacturingOrder.findFirst({
        where: { id: orderId, organizationId },
        include: {
          recipe: { include: { lines: true } },
        },
      });
      if (!order) throw new NotFoundException("Manufacturing order not found");
      if (order.status !== ManufacturingOrderStatus.DRAFT) {
        throw new ConflictException("Order is not in DRAFT status");
      }

      const documentDate = new Date();
      await assertWarehouseNotUnderReconciliation(
        tx,
        organizationId,
        order.warehouseId,
      );

      const batchQty = new Decimal(order.quantity);
      let totalMaterial = new Decimal(0);
      const lineRows: Array<{
        productId: string;
        quantityRequired: Decimal;
        quantityIssued: Decimal;
        unitCost: Decimal;
        lineCost: Decimal;
      }> = [];

      for (const line of order.recipe.lines) {
        const wf =
          line.wasteFactor != null ? new Decimal(line.wasteFactor) : new Decimal(0);
        const need = new Decimal(line.quantityPerUnit)
          .mul(new Decimal(1).add(wf))
          .mul(batchQty);

        const si = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: order.warehouseId,
              productId: line.componentProductId,
            },
          },
        });
        const avail = si?.quantity ?? new Decimal(0);
        const avg = si?.averageCost ?? new Decimal(0);
        if (avail.lt(need)) {
          throw new BadRequestException(
            `Insufficient stock for component ${line.componentProductId}`,
          );
        }

        const unit = await this.stock.computeIssueUnitCost(
          tx,
          organizationId,
          order.warehouseId,
          line.componentProductId,
          need,
          avg,
          avg,
        );
        const lineCost = roundMoney2(need.mul(unit));
        totalMaterial = totalMaterial.add(lineCost);

        const newQty = avail.sub(need);
        await tx.stockItem.upsert({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: order.warehouseId,
              productId: line.componentProductId,
            },
          },
          create: {
            organizationId,
            warehouseId: order.warehouseId,
            productId: line.componentProductId,
            quantity: newQty,
            averageCost: avg,
          },
          update: { quantity: newQty },
        });

        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: order.warehouseId,
            productId: line.componentProductId,
            type: StockMovementType.OUT,
            reason: StockMovementReason.MANUFACTURING,
            quantity: need,
            price: unit,
            note: `MFG_WIP_OUT ${orderId.slice(0, 8)}`,
            documentDate,
          },
        });

        lineRows.push({
          productId: line.componentProductId,
          quantityRequired: need,
          quantityIssued: need,
          unitCost: unit,
          lineCost,
        });
      }

      totalMaterial = roundMoney2(totalMaterial);

      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: documentDate,
        reference: `MFG-WIP-${orderId.slice(0, 8)}`,
        description: `WIP: materials to production order`,
        isFinal: true,
        lines: [
          {
            accountCode: WIP_MANUFACTURING_ACCOUNT_CODE,
            debit: totalMaterial.toString(),
            credit: "0",
          },
          {
            accountCode: INVENTORY_GOODS_ACCOUNT_CODE,
            debit: "0",
            credit: totalMaterial.toString(),
          },
        ],
      });

      await tx.manufacturingOrderLine.createMany({
        data: lineRows.map((r) => ({
          organizationId,
          manufacturingOrderId: orderId,
          productId: r.productId,
          quantityRequired: r.quantityRequired,
          quantityIssued: r.quantityIssued,
          unitCost: r.unitCost,
          lineCost: r.lineCost,
        })),
      });

      return tx.manufacturingOrder.update({
        where: { id: orderId },
        data: {
          status: ManufacturingOrderStatus.IN_PROGRESS,
          materialCost: totalMaterial,
          wipTransactionId: transactionId,
          startedAt: new Date(),
        },
        include: orderInclude,
      });
    });
  }

  async completeOrder(organizationId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.manufacturingOrder.findFirst({
        where: { id: orderId, organizationId },
        include: {
          recipe: { include: { finishedProduct: true, byproducts: true, lines: true } },
          lines: true,
        },
      });
      if (!order) throw new NotFoundException("Manufacturing order not found");
      if (order.status !== ManufacturingOrderStatus.IN_PROGRESS) {
        throw new ConflictException("Order is not IN_PROGRESS");
      }

      const documentDate = new Date();
      const batchQty = new Decimal(order.quantity);
      const totalMaterial = roundMoney2(new Decimal(order.materialCost));
      const unitCost =
        batchQty.gt(0) ? roundMoney2(totalMaterial.div(batchQty)) : new Decimal(0);

      const finSi = await tx.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: order.warehouseId,
            productId: order.recipe.finishedProductId,
          },
        },
      });
      const q0 = finSi?.quantity ?? new Decimal(0);
      const c0 = finSi?.averageCost ?? new Decimal(0);
      const q1 = q0.add(batchQty);
      const c1 =
        q1.lte(0)
          ? new Decimal(0)
          : q0.lte(0)
            ? unitCost
            : roundMoney2(q0.mul(c0).add(batchQty.mul(unitCost)).div(q1));

      await tx.stockItem.upsert({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: order.warehouseId,
            productId: order.recipe.finishedProductId,
          },
        },
        create: {
          organizationId,
          warehouseId: order.warehouseId,
          productId: order.recipe.finishedProductId,
          quantity: q1,
          averageCost: c1,
        },
        update: { quantity: q1, averageCost: c1 },
      });

      const fgMovement = await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: order.warehouseId,
          productId: order.recipe.finishedProductId,
          type: StockMovementType.IN,
          reason: StockMovementReason.MANUFACTURING,
          quantity: batchQty,
          price: unitCost,
          note: `MFG_IN ${orderId.slice(0, 8)}`,
          documentDate,
        },
      });

      for (const by of order.recipe.byproducts) {
        const byQty = new Decimal(by.quantityPerUnit).mul(batchQty);
        if (byQty.lte(0)) continue;
        const byCostFactor = new Decimal(by.costFactor ?? 0);
        const byTotalCost = roundMoney2(totalMaterial.mul(byCostFactor));
        const byUnitCost =
          byQty.gt(0) ? roundMoney2(byTotalCost.div(byQty)) : new Decimal(0);

        const bySi = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: order.warehouseId,
              productId: by.productId,
            },
          },
        });
        const bq0 = bySi?.quantity ?? new Decimal(0);
        const bc0 = bySi?.averageCost ?? new Decimal(0);
        const bq1 = bq0.add(byQty);
        const bc1 =
          bq1.lte(0)
            ? new Decimal(0)
            : bq0.lte(0)
              ? byUnitCost
              : roundMoney2(bq0.mul(bc0).add(byQty.mul(byUnitCost)).div(bq1));

        await tx.stockItem.upsert({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: order.warehouseId,
              productId: by.productId,
            },
          },
          create: {
            organizationId,
            warehouseId: order.warehouseId,
            productId: by.productId,
            quantity: bq1,
            averageCost: bc1,
          },
          update: { quantity: bq1, averageCost: bc1 },
        });

        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: order.warehouseId,
            productId: by.productId,
            type: StockMovementType.IN,
            reason: StockMovementReason.MANUFACTURING,
            quantity: byQty,
            price: byUnitCost,
            note: "MFG_BYPRODUCT_IN",
            documentDate,
          },
        });
      }

      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: documentDate,
        reference: `MFG-FG-${orderId.slice(0, 8)}`,
        description: `Release FG from WIP: ${order.recipe.finishedProduct.name}`,
        isFinal: true,
        lines: [
          {
            accountCode: FINISHED_GOODS_ACCOUNT_CODE,
            debit: totalMaterial.toString(),
            credit: "0",
          },
          {
            accountCode: WIP_MANUFACTURING_ACCOUNT_CODE,
            debit: "0",
            credit: totalMaterial.toString(),
          },
        ],
      });

      const mRelease = await tx.manufacturingRelease.create({
        data: {
          organizationId,
          recipeId: order.recipeId,
          finishedProductId: order.recipe.finishedProductId,
          warehouseId: order.warehouseId,
          quantity: batchQty,
          materialCost: totalMaterial,
          documentDate,
          finishedGoodsTransactionId: transactionId,
          finishedGoodsStockMovementId: fgMovement.id,
        },
      });

      return tx.manufacturingOrder.update({
        where: { id: orderId },
        data: {
          status: ManufacturingOrderStatus.COMPLETED,
          completedAt: new Date(),
          manufacturingReleaseId: mRelease.id,
        },
        include: orderInclude,
      });
    });
  }

  async cancelOrder(organizationId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.manufacturingOrder.findFirst({
        where: { id: orderId, organizationId },
        include: { lines: true },
      });
      if (!order) throw new NotFoundException("Manufacturing order not found");
      if (order.status === ManufacturingOrderStatus.COMPLETED) {
        throw new ConflictException("Cannot cancel a completed order");
      }
      if (order.status === ManufacturingOrderStatus.CANCELLED) {
        return order;
      }

      if (order.status === ManufacturingOrderStatus.IN_PROGRESS) {
        const documentDate = new Date();
        const totalMaterial = roundMoney2(new Decimal(order.materialCost));

        for (const line of order.lines) {
          const qty = new Decimal(line.quantityIssued);
          if (qty.lte(0)) continue;

          const si = await tx.stockItem.findUnique({
            where: {
              organizationId_warehouseId_productId: {
                organizationId,
                warehouseId: order.warehouseId,
                productId: line.productId,
              },
            },
          });
          const q0 = si?.quantity ?? new Decimal(0);
          const avg = si?.averageCost ?? new Decimal(0);
          const q1 = q0.add(qty);

          await tx.stockItem.upsert({
            where: {
              organizationId_warehouseId_productId: {
                organizationId,
                warehouseId: order.warehouseId,
                productId: line.productId,
              },
            },
            create: {
              organizationId,
              warehouseId: order.warehouseId,
              productId: line.productId,
              quantity: q1,
              averageCost: avg,
            },
            update: { quantity: q1 },
          });

          await tx.stockMovement.create({
            data: {
              organizationId,
              warehouseId: order.warehouseId,
              productId: line.productId,
              type: StockMovementType.IN,
              reason: StockMovementReason.MANUFACTURING,
              quantity: qty,
              price: new Decimal(line.unitCost),
              note: `MFG_WIP_CANCEL ${orderId.slice(0, 8)}`,
              documentDate,
            },
          });
        }

        if (totalMaterial.gt(0)) {
          await this.accounting.postJournalInTransaction(tx, {
            organizationId,
            date: documentDate,
            reference: `MFG-WIP-CANCEL-${orderId.slice(0, 8)}`,
            description: `Cancel WIP manufacturing order`,
            isFinal: true,
            lines: [
              {
                accountCode: INVENTORY_GOODS_ACCOUNT_CODE,
                debit: totalMaterial.toString(),
                credit: "0",
              },
              {
                accountCode: WIP_MANUFACTURING_ACCOUNT_CODE,
                debit: "0",
                credit: totalMaterial.toString(),
              },
            ],
          });
        }
      }

      return tx.manufacturingOrder.update({
        where: { id: orderId },
        data: { status: ManufacturingOrderStatus.CANCELLED },
        include: orderInclude,
      });
    });
  }

  private async resolveWarehouse(organizationId: string, warehouseId?: string) {
    const wh = warehouseId
      ? await this.prisma.warehouse.findFirst({
          where: { id: warehouseId, organizationId },
        })
      : await this.prisma.warehouse.findFirst({
          where: { organizationId },
          orderBy: { createdAt: "asc" },
        });
    if (!wh) throw new NotFoundException("Warehouse not found");
    return wh;
  }
}
