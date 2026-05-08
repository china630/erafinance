-- PII cutover wave 4:
-- drop legacy plaintext employees.voen column.

ALTER TABLE "employees"
  DROP COLUMN IF EXISTS "voen";
