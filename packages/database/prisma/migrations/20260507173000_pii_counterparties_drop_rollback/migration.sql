-- Rollback wave 5 counterparties drop to keep API compile/runtime stable.
-- We re-introduce legacy plaintext columns as placeholder-only transport fields.

ALTER TABLE "counterparties"
  ADD COLUMN IF NOT EXISTS "tax_id" TEXT NOT NULL DEFAULT '__enc__cp__rollback',
  ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '__enc__name__rollback';

ALTER TABLE "counterparties"
  ADD CONSTRAINT "counterparties_tax_id_placeholder_chk"
  CHECK (LEFT("tax_id", 11) = '__enc__cp__');

ALTER TABLE "counterparties"
  ADD CONSTRAINT "counterparties_name_placeholder_chk"
  CHECK (LEFT("name", 13) = '__enc__name__');
