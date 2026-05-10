import { z } from "zod";

const MoneySchema = z.number().nonnegative();

/** Portal / Excel → ERP draft (mirrors `CustomsDeclaration` monetary fields + optional meta). */
export const CustomsDeclarationPrefillSchema = z.object({
  bgdNumber: z.string().trim().min(1),
  bgdDate: z.string().trim().min(1), // ISO date (YYYY-MM-DD)
  currency: z.string().trim().min(1),
  customsValueAzn: MoneySchema,
  customsDutyAzn: MoneySchema,
  customsVatAzn: MoneySchema,
  feesAzn: MoneySchema,
  regimeCode: z.string().trim().optional(),
  notes: z.string().nullable().optional(),
  portalVoen: z
    .string()
    .trim()
    .regex(/^\d{10}$/)
    .optional()
    .nullable(),
});

export const CustomsDeclarationPrefillCaptureSchema =
  CustomsDeclarationPrefillSchema.extend({
    source: z.enum(["WIDGET", "EXCEL"]),
    capturedAt: z.string().trim().min(1), // ISO datetime
  });

export type CustomsDeclarationPrefill = z.infer<
  typeof CustomsDeclarationPrefillSchema
>;
export type CustomsDeclarationPrefillCapture = z.infer<
  typeof CustomsDeclarationPrefillCaptureSchema
>;

/** Single BGD line item from portal capture. */
export const CustomsDeclarationItemPrefillSchema = z.object({
  sequenceNumber: z.number().int().positive(),
  hsCode: z.string().trim().min(2).max(20),
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  /** @deprecated Prefer `unitOfMeasureCode` (catalog code: pcs, kg, m, …). */
  unit: z.string().trim().optional().nullable(),
  /** System catalog code; wins over `unit` when both are set. */
  unitOfMeasureCode: z.string().trim().optional().nullable(),
  weightNetKg: z.number().nonnegative(),
  weightGrossKg: z.number().nonnegative(),
  invoiceValue: z.number().nonnegative(),
  statisticalValueAzn: z.number().nonnegative(),
  portalDutyAzn: z.number().nonnegative().optional().nullable(),
  portalVatAzn: z.number().nonnegative().optional().nullable(),
});

export const CustomsDeclarationFullPrefillSchema =
  CustomsDeclarationPrefillSchema.extend({
    senderVoen: z
      .string()
      .trim()
      .regex(/^\d{10}$/)
      .optional()
      .nullable(),
    senderName: z.string().trim().optional().nullable(),
    receiverVoen: z
      .string()
      .trim()
      .regex(/^\d{10}$/)
      .optional()
      .nullable(),
    receiverName: z.string().trim().optional().nullable(),
    currencyRate: z.number().positive().optional().nullable(),
    items: z.array(CustomsDeclarationItemPrefillSchema).min(1).max(200),
  });

export const CustomsDeclarationFullPrefillCaptureSchema =
  CustomsDeclarationFullPrefillSchema.extend({
    source: z.enum(["WIDGET", "EXCEL"]),
    capturedAt: z.string().trim().min(1),
  });

export type CustomsDeclarationItemPrefill = z.infer<
  typeof CustomsDeclarationItemPrefillSchema
>;
export type CustomsDeclarationFullPrefill = z.infer<
  typeof CustomsDeclarationFullPrefillSchema
>;
export type CustomsDeclarationFullPrefillCapture = z.infer<
  typeof CustomsDeclarationFullPrefillCaptureSchema
>;
