-- Self-service profile: lock email change after verification (nullable until product flow sets it)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ(6);
