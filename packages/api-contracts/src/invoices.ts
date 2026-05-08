import { z } from "zod";

const MoneySchema = z.number().nonnegative();

export const InvoicePrefillCounterpartySchema = z.object({
  id: z.string(),
  name: z.string(),
  taxId: z
    .string()
    .trim()
    .regex(/^\d{10}$/)
    .nullable(),
  legalForm: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isVatPayer: z.boolean().nullable().optional(),
});

export const InvoicePrefillLineSchema = z.object({
  name: z.string(),
  sku: z.string().nullable().optional(),
  quantity: MoneySchema,
  unit: z.string().nullable().optional(),
  unitPriceAzn: MoneySchema,
  vatRatePct: z.number().min(0),
  vatExempt: z.boolean().default(false),
  totalNetAzn: MoneySchema,
  totalVatAzn: MoneySchema,
  totalGrossAzn: MoneySchema,
});

export const ForeignInvoiceSupplierSchema = z.object({
  name: z.string(),
  taxId: z.string().trim().optional().nullable(),
  country: z.string(),
  address: z.string().optional().nullable(),
});

export const ForeignInvoicePrefillLineSchema = InvoicePrefillLineSchema.extend({
  vatRatePct: z.number().min(0).optional(),
});

export const InvoicePrefillSchema = z.object({
  id: z.string(),
  number: z.string(),
  issueDate: z.string(),
  currency: z.literal("AZN"),
  counterparty: InvoicePrefillCounterpartySchema,
  items: z.array(InvoicePrefillLineSchema),
  totals: z.object({
    netAzn: MoneySchema,
    vatAzn: MoneySchema,
    grossAzn: MoneySchema,
  }),
  notes: z.string().nullable().optional(),
  isInternational: z.boolean().optional(),
});

export const ForeignInvoicePrefillSchema = z.object({
  id: z.string().optional(),
  number: z.string(),
  issueDate: z.string(),
  currency: z.string(),
  supplier: ForeignInvoiceSupplierSchema,
  items: z.array(ForeignInvoicePrefillLineSchema),
  totals: z.object({
    netAzn: MoneySchema.optional(),
    vatAzn: MoneySchema.optional(),
    grossAzn: MoneySchema.optional(),
  }),
  notes: z.string().nullable().optional(),
});

export const InvoiceCreateContractSchema = z.object({
  counterpartyId: z.string(),
  dueDate: z.string(),
  currency: z.string().optional(),
  fxRateToAzn: z.number().positive().optional(),
  vatInclusive: z.boolean().optional(),
  isInternational: z.boolean().optional(),
});

export const InvoiceGetContractSchema = z.object({
  id: z.string(),
  number: z.string(),
  currency: z.string(),
  isInternational: z.boolean().optional(),
});

export type InvoicePrefillCounterparty = z.infer<typeof InvoicePrefillCounterpartySchema>;
export type InvoicePrefillLine = z.infer<typeof InvoicePrefillLineSchema>;
export type InvoicePrefill = z.infer<typeof InvoicePrefillSchema>;
export type ForeignInvoicePrefill = z.infer<typeof ForeignInvoicePrefillSchema>;
export type InvoiceCreateContract = z.infer<typeof InvoiceCreateContractSchema>;
export type InvoiceGetContract = z.infer<typeof InvoiceGetContractSchema>;
