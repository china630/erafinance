import { Injectable, NotFoundException } from "@nestjs/common";
import { CustomsDeclarationStatus, Prisma } from "@erafinance/database";
import type { CustomsDeclarationFullPrefillCapture, CustomsDeclarationPrefillCapture } from "@erafinance/api-contracts";
import { normalizeUnitInputToCatalogCode } from "../common/unit-of-measure-normalize";
import { AccountingService } from "../accounting/accounting.service";
import {
  INVENTORY_GOODS_ACCOUNT_CODE,
  PAYABLE_SUPPLIERS_ACCOUNT_CODE,
  VAT_INPUT_ACCOUNT_CODE,
} from "../ledger.constants";
import { CounterpartiesService } from "../counterparties/counterparties.service";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationSyncRunService } from "../integrations/integration-sync-run.service";
import { AttachCustomsDeclarationDto, UpsertCustomsDeclarationDto } from "./dto/customs-declaration.dto";
import { CustomsTaxCalculatorService } from "./customs-tax-calculator.service";

function buildFullCaptureNotes(dto: CustomsDeclarationFullPrefillCapture): string | null {
  const lines: string[] = [];
  if (dto.notes?.trim()) {
    lines.push(dto.notes.trim());
  }
  const meta = {
    source: dto.source,
    capturedAt: dto.capturedAt,
    regimeCode: dto.regimeCode ?? null,
    portalVoen: dto.portalVoen ?? null,
    itemCount: dto.items.length,
  };
  lines.push(`[capture] ${JSON.stringify(meta)}`);
  return lines.join("\n");
}

export type PrefillCaptureResult = {
  id: string;
  bgdNumber: string;
  deduplicated: boolean;
  mismatchPctDuty?: number;
  mismatchPctVat?: number;
};

@Injectable()
export class CustomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly syncRuns: IntegrationSyncRunService,
    private readonly counterparties: CounterpartiesService,
    private readonly taxCalculator: CustomsTaxCalculatorService,
  ) {}

  list(organizationId: string) {
    return this.prisma.customsDeclaration.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ bgdDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        bgdNumber: true,
        bgdDate: true,
        currency: true,
        customsValueAzn: true,
        status: true,
        senderName: true,
        receiverName: true,
        _count: { select: { items: true } },
      },
    });
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.customsDeclaration.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        items: { orderBy: { sequenceNumber: "asc" } },
      },
    });
    if (!row) throw new NotFoundException("Customs declaration not found");

    let portalDutySum = new Prisma.Decimal(0);
    let portalVatSum = new Prisma.Decimal(0);
    let calcDutySum = new Prisma.Decimal(0);
    let calcVatSum = new Prisma.Decimal(0);

    for (const it of row.items) {
      calcDutySum = calcDutySum.add(it.calculatedDutyAzn);
      calcVatSum = calcVatSum.add(it.calculatedVatAzn);
      if (it.portalDutyAzn != null) portalDutySum = portalDutySum.add(it.portalDutyAzn);
      if (it.portalVatAzn != null) portalVatSum = portalVatSum.add(it.portalVatAzn);
    }

    const mismatchPctDuty =
      portalDutySum.gt(0) && calcDutySum.gt(0)
        ? Number(portalDutySum.sub(calcDutySum).div(calcDutySum).mul(100).abs().toFixed(2))
        : undefined;
    const mismatchPctVat =
      portalVatSum.gt(0) && calcVatSum.gt(0)
        ? Number(portalVatSum.sub(calcVatSum).div(calcVatSum).mul(100).abs().toFixed(2))
        : undefined;

    return {
      ...row,
      mismatchPctDuty,
      mismatchPctVat,
    };
  }

  async create(organizationId: string, dto: UpsertCustomsDeclarationDto) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO customs_declarations (id, organization_id, bgd_number, bgd_date, currency, customs_value_azn, customs_duty_azn, customs_vat_azn, fees_azn, notes, status, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1::uuid, $2, $3::date, $4, $5, $6, $7, $8, $9, 'DRAFT'::"CustomsDeclarationStatus", now(), now())`,
      organizationId,
      dto.bgdNumber.trim(),
      dto.bgdDate,
      dto.currency,
      dto.customsValueAzn,
      dto.customsDutyAzn,
      dto.customsVatAzn,
      dto.feesAzn,
      dto.notes ?? null,
    );
    return { ok: true };
  }

  /**
   * Flat widget / legacy capture: one synthetic line item + full draft pipeline.
   */
  async createDraftFromCapture(
    organizationId: string,
    dto: CustomsDeclarationPrefillCapture,
    userId: string,
  ): Promise<PrefillCaptureResult> {
    const full: CustomsDeclarationFullPrefillCapture = {
      ...dto,
      items: [
        {
          sequenceNumber: 1,
          hsCode: "00000000",
          description: "Aggregate capture (no HS line items)",
          quantity: 1,
          unit: null,
          unitOfMeasureCode: null,
          weightNetKg: 0,
          weightGrossKg: 0,
          invoiceValue: dto.customsValueAzn,
          statisticalValueAzn: dto.customsValueAzn,
          portalDutyAzn: dto.customsDutyAzn,
          portalVatAzn: dto.customsVatAzn,
        },
      ],
      senderVoen: null,
      senderName: null,
      receiverVoen: null,
      receiverName: null,
      currencyRate: null,
    };
    return this.createFullDraftFromCapture(organizationId, full, userId);
  }

  /**
   * Full BGD capture with line items, counterparties, and GATT calculator.
   */
  async createFullDraftFromCapture(
    organizationId: string,
    dto: CustomsDeclarationFullPrefillCapture,
    userId: string,
  ): Promise<PrefillCaptureResult> {
    const bgdNumber = dto.bgdNumber.trim();
    const existing = await this.prisma.customsDeclaration.findUnique({
      where: {
        organizationId_bgdNumber: { organizationId, bgdNumber },
      },
      select: { id: true },
    });
    if (existing) {
      return { id: existing.id, bgdNumber, deduplicated: true };
    }

    const bgdDate = new Date(`${dto.bgdDate.slice(0, 10)}T00:00:00.000Z`);
    const notes = buildFullCaptureNotes(dto);

    let senderCounterpartyId: string | null = null;
    let receiverCounterpartyId: string | null = null;
    if (dto.senderVoen && /^\d{10}$/.test(dto.senderVoen)) {
      const cp = await this.counterparties.findOrCreateByVoen({
        organizationId,
        taxId: dto.senderVoen,
        nameFallback: (dto.senderName ?? dto.senderVoen).trim() || dto.senderVoen,
      });
      senderCounterpartyId = cp.id;
    }
    if (dto.receiverVoen && /^\d{10}$/.test(dto.receiverVoen)) {
      const cp = await this.counterparties.findOrCreateByVoen({
        organizationId,
        taxId: dto.receiverVoen,
        nameFallback: (dto.receiverName ?? dto.receiverVoen).trim() || dto.receiverVoen,
      });
      receiverCounterpartyId = cp.id;
    }

    const sortedItems = [...dto.items].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const { lines: computed, totalDuty, totalVat } = await this.taxCalculator.computeLines(
      sortedItems,
      bgdDate,
    );

    const totalInvoice = sortedItems.reduce((s, i) => s + i.invoiceValue, 0);
    const totalStat = sortedItems.reduce((s, i) => s + i.statisticalValueAzn, 0);

    const itemRows = sortedItems.map((it, idx) => {
      const c = computed[idx]!;
      return {
        organizationId,
        sequenceNumber: it.sequenceNumber,
        hsCode: (() => {
          const d = it.hsCode.replace(/\D/g, "").trim();
          return d.length > 0 ? d : "00";
        })(),
        description: it.description.trim(),
        quantity: new Prisma.Decimal(it.quantity),
        unitOfMeasureCode: normalizeUnitInputToCatalogCode(
          it.unitOfMeasureCode ?? it.unit,
        ),
        weightNetKg: new Prisma.Decimal(it.weightNetKg),
        weightGrossKg: new Prisma.Decimal(it.weightGrossKg),
        invoiceValue: new Prisma.Decimal(it.invoiceValue),
        statisticalValueAzn: new Prisma.Decimal(it.statisticalValueAzn),
        dutyRatePercent: c.dutyRatePercent,
        vatRatePercent: c.vatRatePercent,
        excisePercent: c.excisePercent,
        calculatedDutyAzn: c.calculatedDutyAzn,
        calculatedVatAzn: c.calculatedVatAzn,
        calculatedExciseAzn: c.calculatedExciseAzn,
        portalDutyAzn:
          it.portalDutyAzn != null && it.portalDutyAzn !== undefined
            ? new Prisma.Decimal(it.portalDutyAzn)
            : null,
        portalVatAzn:
          it.portalVatAzn != null && it.portalVatAzn !== undefined
            ? new Prisma.Decimal(it.portalVatAzn)
            : null,
        notes: null as string | null,
      };
    });

    let portalDutySum = new Prisma.Decimal(0);
    let portalVatSum = new Prisma.Decimal(0);
    for (const it of sortedItems) {
      if (it.portalDutyAzn != null) portalDutySum = portalDutySum.add(new Prisma.Decimal(it.portalDutyAzn));
      if (it.portalVatAzn != null) portalVatSum = portalVatSum.add(new Prisma.Decimal(it.portalVatAzn));
    }

    const mismatchPctDuty =
      portalDutySum.gt(0) && totalDuty.gt(0)
        ? Number(portalDutySum.sub(totalDuty).div(totalDuty).mul(100).abs().toFixed(2))
        : undefined;
    const mismatchPctVat =
      portalVatSum.gt(0) && totalVat.gt(0)
        ? Number(portalVatSum.sub(totalVat).div(totalVat).mul(100).abs().toFixed(2))
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      const runId = await this.syncRuns.start(
        {
          organizationId,
          portal: "CUSTOMS",
          flow: "bgd-capture-full",
          transport: "RPA_WIDGET",
          totalCount: dto.items.length,
          triggeredByUserId: userId,
        },
        tx,
      );

      try {
        const row = await tx.customsDeclaration.create({
          data: {
            organizationId,
            bgdNumber,
            bgdDate,
            currency: dto.currency.trim(),
            customsValueAzn: new Prisma.Decimal(dto.customsValueAzn),
            customsDutyAzn: new Prisma.Decimal(dto.customsDutyAzn),
            customsVatAzn: new Prisma.Decimal(dto.customsVatAzn),
            feesAzn: new Prisma.Decimal(dto.feesAzn),
            notes,
            status: CustomsDeclarationStatus.DRAFT,
            regimeCode: dto.regimeCode?.trim() || null,
            currencyRate:
              dto.currencyRate != null && dto.currencyRate !== undefined
                ? new Prisma.Decimal(dto.currencyRate)
                : null,
            senderVoen: dto.senderVoen?.trim() ?? null,
            senderName: dto.senderName?.trim() ?? null,
            receiverVoen: dto.receiverVoen?.trim() ?? null,
            receiverName: dto.receiverName?.trim() ?? null,
            senderCounterpartyId,
            receiverCounterpartyId,
            totalInvoiceValue: new Prisma.Decimal(totalInvoice),
            totalStatisticalValueAzn: new Prisma.Decimal(totalStat),
            calculatedDutyAzn: totalDuty,
            calculatedVatAzn: totalVat,
            items: { create: itemRows },
          },
          select: { id: true, bgdNumber: true },
        });

        await this.syncRuns.complete(
          {
            runId,
            successCount: dto.items.length,
            errorCount: 0,
            notes: { bgdNumber, source: dto.source, itemCount: dto.items.length },
          },
          tx,
        );

        return {
          id: row.id,
          bgdNumber: row.bgdNumber,
          deduplicated: false,
          mismatchPctDuty,
          mismatchPctVat,
        };
      } catch (e) {
        await this.syncRuns.complete(
          {
            runId,
            successCount: 0,
            errorCount: 1,
            notes: {
              error: e instanceof Error ? e.message : String(e),
              bgdNumber,
            },
          },
          tx,
        );
        throw e;
      }
    });
  }

  async attach(organizationId: string, id: string, dto: AttachCustomsDeclarationDto) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{ customs_duty_azn: string; customs_vat_azn: string; fees_azn: string; bgd_number: string }>
      >(
        `SELECT customs_duty_azn, customs_vat_azn, fees_azn, bgd_number FROM customs_declarations WHERE id=$1::uuid AND organization_id=$2::uuid LIMIT 1`,
        id,
        organizationId,
      );
      const row = rows[0];
      if (!row) throw new NotFoundException("Customs declaration not found");
      const inventoryDr = new Prisma.Decimal(row.customs_duty_azn).add(new Prisma.Decimal(row.fees_azn));
      const vatDr = new Prisma.Decimal(row.customs_vat_azn);
      const totalCr = inventoryDr.add(vatDr);
      await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: new Date(),
        reference: row.bgd_number,
        description: `BGD attach ${row.bgd_number}`,
        lines: [
          { accountCode: INVENTORY_GOODS_ACCOUNT_CODE, debit: inventoryDr.toString(), credit: 0 },
          { accountCode: VAT_INPUT_ACCOUNT_CODE, debit: vatDr.toString(), credit: 0 },
          { accountCode: PAYABLE_SUPPLIERS_ACCOUNT_CODE, debit: 0, credit: totalCr.toString() },
        ],
      });
      await tx.customsDeclaration.update({
        where: { id, organizationId },
        data: {
          linkedPurchaseTransactionId: dto.purchaseTransactionId,
          status: CustomsDeclarationStatus.ATTACHED,
        },
      });
      return { ok: true };
    });
  }
}
