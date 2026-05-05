-- Sync inventory + invoices schema with API expectations

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "purchase_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "sales_snapshot" JSONB;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "revenue_posted_transaction_id" UUID;

ALTER TYPE "StockMovementReason" ADD VALUE IF NOT EXISTS 'RECEIPT';
ALTER TYPE "StockMovementReason" ADD VALUE IF NOT EXISTS 'SHIPMENT';
ALTER TYPE "StockMovementReason" ADD VALUE IF NOT EXISTS 'TRANSFER';
