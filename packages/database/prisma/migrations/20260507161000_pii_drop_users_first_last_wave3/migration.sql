-- PII cutover wave 3:
-- drop legacy plaintext users.first_name / users.last_name columns.

ALTER TABLE "users"
  DROP CONSTRAINT IF EXISTS "users_first_name_placeholder_chk";

ALTER TABLE "users"
  DROP CONSTRAINT IF EXISTS "users_last_name_placeholder_chk";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "first_name",
  DROP COLUMN IF EXISTS "last_name";
