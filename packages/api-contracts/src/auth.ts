import { z } from "zod";

/** Matches Prisma `UserRole` subset used in JWT / public user. */
export const UserRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "ACCOUNTANT",
  "USER",
  "PROCUREMENT",
  "AUDITOR",
  "WAREHOUSE_KEEPER",
  "HR_OFFICER",
  "HR_MANAGER",
  "DEPARTMENT_HEAD",
]);

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: UserRoleSchema.nullable(),
  organizationId: z.string().nullable(),
  isSuperAdmin: z.boolean(),
});

export const OrgSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  taxId: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "OrgSummary.taxId must be a 10-digit VÖEN"),
  currency: z.string(),
  role: UserRoleSchema,
});

export const AuthSnapshotSchema = z.object({
  user: PublicUserSchema,
  organizations: z.array(OrgSummarySchema),
  access: z
    .object({
      canPostAccounting: z.boolean(),
      canViewHoldingReports: z.boolean(),
    })
    .optional(),
});

/** Response body for POST /api/auth/extension/refresh (refresh stripped). */
export const ExtensionRefreshResponseSchema = z
  .object({
    accessToken: z.string(),
    expiresAt: z.string().optional(),
    user: PublicUserSchema,
    organizations: z.array(OrgSummarySchema),
    access: z
      .object({
        canPostAccounting: z.boolean(),
        canViewHoldingReports: z.boolean(),
      })
      .optional(),
  })
  .passthrough();

export type PublicUser = z.infer<typeof PublicUserSchema>;
export type OrgSummary = z.infer<typeof OrgSummarySchema>;
export type AuthSnapshot = z.infer<typeof AuthSnapshotSchema>;
export type ExtensionRefreshResponse = z.infer<
  typeof ExtensionRefreshResponseSchema
>;
