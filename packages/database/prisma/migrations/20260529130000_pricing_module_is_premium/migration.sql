-- Admin-manageable premium flag on pricing_modules (idempotent).

ALTER TABLE pricing_modules
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

UPDATE pricing_modules
SET is_premium = true, updated_at = now()
WHERE key IN ('tax_pro', 'trade_pro', 'compliance_pro', 'audit_hub');
