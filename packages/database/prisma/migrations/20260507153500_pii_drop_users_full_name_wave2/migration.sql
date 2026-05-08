-- PII cutover wave 2 (safe-first):
-- drop legacy plaintext users.full_name column.

ALTER TABLE "users"
  DROP CONSTRAINT IF EXISTS "users_full_name_placeholder_chk";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "full_name";
