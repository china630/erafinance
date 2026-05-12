import { Injectable } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import type { CustomsDeclarationItemPrefill } from "@erafinance/api-contracts";
import { CustomsTariffRatesService } from "./customs-tariff-rates.service";

export type ComputedLine = {
  sequenceNumber: number;
  dutyRatePercent: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  excisePercent: Prisma.Decimal;
  calculatedDutyAzn: Prisma.Decimal;
  calculatedExciseAzn: Prisma.Decimal;
  calculatedVatAzn: Prisma.Decimal;
};

@Injectable()
export class CustomsTaxCalculatorService {
  constructor(private readonly tariffs: CustomsTariffRatesService) {}

  /**
   * GATT-style simplified stack: duty and excise on statistical value; VAT on (value + duty + excise).
   */
  async computeLines(
    items: CustomsDeclarationItemPrefill[],
    bgdDate: Date,
  ): Promise<{ lines: ComputedLine[]; totalDuty: Prisma.Decimal; totalVat: Prisma.Decimal; totalExcise: Prisma.Decimal }> {
    const lines: ComputedLine[] = [];
    let totalDuty = new Prisma.Decimal(0);
    let totalVat = new Prisma.Decimal(0);
    let totalExcise = new Prisma.Decimal(0);

    const tariffRows = await this.tariffs.loadActiveRates(bgdDate);

    for (const it of items) {
      const match = this.tariffs.findBestMatchFromRows(tariffRows, it.hsCode);
      const dutyRate = match.dutyRatePercent;
      const vatRate = match.vatRatePercent;
      const exciseRate = match.excisePercent;

      const dutyBase = new Prisma.Decimal(it.statisticalValueAzn);
      const duty = dutyBase.mul(dutyRate).div(new Prisma.Decimal(100));
      const excise = dutyBase.mul(exciseRate).div(new Prisma.Decimal(100));
      const vatBase = dutyBase.add(duty).add(excise);
      const vat = vatBase.mul(vatRate).div(new Prisma.Decimal(100));

      lines.push({
        sequenceNumber: it.sequenceNumber,
        dutyRatePercent: dutyRate,
        vatRatePercent: vatRate,
        excisePercent: exciseRate,
        calculatedDutyAzn: duty,
        calculatedExciseAzn: excise,
        calculatedVatAzn: vat,
      });
      totalDuty = totalDuty.add(duty);
      totalVat = totalVat.add(vat);
      totalExcise = totalExcise.add(excise);
    }

    return { lines, totalDuty, totalVat, totalExcise };
  }
}
