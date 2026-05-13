import { Prisma } from "@erafinance/database";
import { getActorUserId } from "../common/actor-context";
import { isIncludeSoftDeleted } from "./recovery-context";

function aliveOrgHoldingWhere(where: unknown): Record<string, unknown> {
  if (where == null || typeof where !== "object") {
    return { isDeleted: false };
  }
  return { AND: [{ isDeleted: false }, where as Record<string, unknown>] };
}

function aliveDeletedAtWhere(where: unknown): Record<string, unknown> {
  if (isIncludeSoftDeleted()) {
    return (where == null || typeof where !== "object"
      ? {}
      : (where as Record<string, unknown>)) as Record<string, unknown>;
  }
  if (where == null || typeof where !== "object") {
    return { deletedAt: null };
  }
  return { AND: [{ deletedAt: null }, where as Record<string, unknown>] };
}

function mergeDeletedAtUnique(where: unknown): Record<string, unknown> {
  if (isIncludeSoftDeleted()) {
    return where == null || typeof where !== "object"
      ? {}
      : (where as Record<string, unknown>);
  }
  if (where == null || typeof where !== "object") {
    return { deletedAt: null };
  }
  return { ...(where as Record<string, unknown>), deletedAt: null };
}

/** PascalCase Prisma model names with `deletedAt` soft-delete (R1.1). */
export const SOFT_DELETE_DELETED_AT_MODELS = new Set<string>([
  "OrganizationMembership",
  "OrganizationInvite",
  "AccessRequest",
  "Department",
  "JobPosition",
  "Employee",
  "Warehouse",
  "WarehouseBin",
  "StockItem",
  "InventoryAudit",
  "InventoryAuditLine",
  "InventoryAdjustment",
  "InventoryAdjustmentLine",
  "CashDesk",
  "CashFlowItem",
  "PayrollRun",
  "SalaryRegistry",
  "BankPaymentDraft",
  "PayrollSlip",
  "Absence",
  "Timesheet",
  "TimesheetEntry",
  "Notification",
  "Account",
  "AccountMapping",
  "IfrsMappingRule",
  "Counterparty",
  "CounterpartyBankAccount",
  "Product",
  "ProductRecipe",
  "ProductRecipeLine",
  "ProductRecipeByproduct",
  "FixedAsset",
  "FixedAssetDepreciationMonth",
  "Invoice",
  "InvoicePayment",
  "InvoiceItem",
  "CustomsDeclaration",
  "TaxDeclarationExport",
  "AdvanceReport",
  "OrganizationBankAccount",
]);

function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Auto-filter alive rows; `delete` / `deleteMany` become timestamped soft-delete.
 * `Organization` / `Holding` keep legacy `isDeleted` behaviour.
 *
 * `client` is the Prisma client already wrapped by prior extensions (e.g. tenant).
 */
export const prismaSoftDeleteExtension = Prisma.defineExtension(
  (client: any) =>
  client.$extends({
    name: "softDelete",
    query: {
      organization: {
        findMany({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
        findFirst({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
        count({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
        aggregate({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
        groupBy({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
      },
      holding: {
        findMany({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
        findFirst({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
        count({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
        aggregate({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
        groupBy({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
          return query({ ...args, where: aliveOrgHoldingWhere(args.where) });
        },
      },
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: unknown;
          query: (a: unknown) => Promise<unknown>;
        }) {
          if (!SOFT_DELETE_DELETED_AT_MODELS.has(model)) {
            return query(args);
          }

          const d = delegateName(model);
          const delegate = client[d] as {
            update: (a: unknown) => Promise<unknown>;
            updateMany: (a: unknown) => Promise<unknown>;
          };

          const a = (args ?? {}) as Record<string, unknown>;
          const q = query;

          switch (operation) {
            case "findMany":
              return q({
                ...a,
                where: aliveDeletedAtWhere(a.where),
              });
            case "findFirst":
              return q({
                ...a,
                where: aliveDeletedAtWhere(a.where),
              });
            case "findUnique":
            case "findUniqueOrThrow":
              return q({
                ...a,
                where: mergeDeletedAtUnique(a.where),
              });
            case "count":
              return q({
                ...a,
                where: aliveDeletedAtWhere(a.where),
              });
            case "aggregate":
              return q({
                ...a,
                where: aliveDeletedAtWhere(a.where),
              });
            case "groupBy":
              return q({
                ...a,
                where: aliveDeletedAtWhere(a.where),
              });
            case "update":
              return q({
                ...a,
                where: mergeDeletedAtUnique(a.where),
              });
            case "updateMany":
              return q({
                ...a,
                where: aliveDeletedAtWhere(a.where),
              });
            case "delete":
              return delegate.update({
                where: mergeDeletedAtUnique(a.where),
                data: {
                  deletedAt: new Date(),
                  deletedByUserId: getActorUserId(),
                },
              });
            case "deleteMany":
              return delegate.updateMany({
                where: aliveDeletedAtWhere(a.where),
                data: {
                  deletedAt: new Date(),
                  deletedByUserId: getActorUserId(),
                },
              });
            case "upsert":
              return q({
                ...a,
                where: mergeDeletedAtUnique(a.where),
              });
            default:
              return query(args);
          }
        },
      },
    },
  }),
);
