# Control plane boundary (Phase 3)

Billing, subscription, RBAC, and tenancy-limit models are **owned by** `era-365-orchestrator` (`@era365/database`).

| Domain | Orchestrator models | Finance data plane |
|--------|---------------------|-------------------|
| Billing | `TenantBilling`, `OrganizationSubscription`, `SubscriptionInvoice`, `BillingInvoiceItem`, `UsageMeterEvent`, `Pricing*` | — |
| Tenancy / RBAC | `OrganizationMembership`, `AccessRequest`, `OrganizationInvite`, `Role`, `Permission` | `Organization`, `User` (tenant context) |
| Ledger | — | `Account`, `JournalEntry`, `Transaction`, `AccountBalance` |
| Inventory | — | `StockItem`, `StockMovement`, `Warehouse`, … |
| Payroll | — | `Employee`, `PayrollRun`, `PayrollSlip`, … |

Finance API uses `ControlPlaneEntitlementGuard` → `era-365-orchestrator` `/internal/v1/entitlements/validate`.

Legacy columns on `organizations` remain until `tenant_billing` backfill migration is applied in all environments.
