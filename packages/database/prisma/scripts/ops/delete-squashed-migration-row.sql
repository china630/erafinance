-- Removes Prisma Migrate history for the squashed migration so `prisma migrate deploy` will apply it again.
-- Use when the DB has no app tables (e.g. public.users) but a row exists with rolled_back_at set and
-- `migrate deploy` still reports "No pending migrations".
DELETE FROM public."_prisma_migrations"
WHERE migration_name = '20260520120000_squashed_schema';
