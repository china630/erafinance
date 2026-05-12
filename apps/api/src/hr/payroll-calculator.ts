import { Prisma } from "@erafinance/database";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/** decimal.js: ROUND_HALF_UP — округление каждого налога до 2 знаков. */
const RM_HALF_UP = 4;

export function roundMoney2(d: Decimal): Decimal {
  return new Decimal(d.toDecimalPlaces(2, RM_HALF_UP));
}

export type PayrollBreakdownPrivate = {
  gross: Decimal;
  /** Штатники: подоходный по профилю. ГПХ (CONTRACTOR): удержание 5% у источника (хранится в том же поле в БД). */
  incomeTax: Decimal;
  dsmfWorker: Decimal;
  dsmfEmployer: Decimal;
  itsWorker: Decimal;
  itsEmployer: Decimal;
  unemploymentWorker: Decimal;
  unemploymentEmployer: Decimal;
  /** Удержание с ГПХ (фикс. соц.), для штатных — 0 */
  contractorSocialWithheld: Decimal;
  net: Decimal;
};

