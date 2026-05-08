import { z } from "zod";

/**
 * Minimal DTO for ƏMAS e-müqavilə prefill from ERP.
 * Field names are portal-agnostic; connector maps to DOM selectors.
 */
export const EmployeeContractPrefillSchema = z.object({
  employeeId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  finCode: z.string().nullable(),
  positionTitle: z.string().nullable(),
  departmentName: z.string().nullable(),
  /** Gross monthly salary in AZN (string for portal decimal fields). */
  salaryGrossAzn: z.string().nullable(),
  contractStartDate: z.string().nullable(),
  contractEndDate: z.string().nullable().optional(),
  /** Optional contract / document id in ERP for audit correlation. */
  contractId: z.string().optional(),
});

export type EmployeeContractPrefill = z.infer<
  typeof EmployeeContractPrefillSchema
>;

export const PrefillRequestSchema = z.object({
  organizationId: z.string(),
  employeeId: z.string(),
});

export type PrefillRequest = z.infer<typeof PrefillRequestSchema>;
