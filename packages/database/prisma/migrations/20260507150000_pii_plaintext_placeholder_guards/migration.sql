-- Prevent accidental write-back of raw PII into legacy plaintext columns.
-- Transitional guard before final plaintext column drops.

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_tax_id_placeholder_chk"
  CHECK (LEFT("tax_id", 12) = '__enc__org__');

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_fin_code_placeholder_chk"
  CHECK (LEFT("fin_code", 12) = '__enc__fin__');

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_first_name_placeholder_chk"
  CHECK (LEFT("first_name", 11) = '__enc__fn__');

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_last_name_placeholder_chk"
  CHECK (LEFT("last_name", 11) = '__enc__ln__');

ALTER TABLE "counterparties"
  ADD CONSTRAINT "counterparties_tax_id_placeholder_chk"
  CHECK (LEFT("tax_id", 11) = '__enc__cp__');

ALTER TABLE "counterparties"
  ADD CONSTRAINT "counterparties_name_placeholder_chk"
  CHECK (LEFT("name", 13) = '__enc__name__');

ALTER TABLE "users"
  ADD CONSTRAINT "users_first_name_placeholder_chk"
  CHECK ("first_name" IS NULL OR LEFT("first_name", 13) = '__enc__ufn__');

ALTER TABLE "users"
  ADD CONSTRAINT "users_last_name_placeholder_chk"
  CHECK ("last_name" IS NULL OR LEFT("last_name", 13) = '__enc__uln__');

ALTER TABLE "users"
  ADD CONSTRAINT "users_full_name_placeholder_chk"
  CHECK ("full_name" IS NULL OR LEFT("full_name", 15) = '__enc__ufull__');
