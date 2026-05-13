-- LOCAL / DISPOSABLE DEV ONLY — never run against staging or production.
-- Drops everything in `public` (all app tables, enums, and `_prisma_migrations`), then recreates an empty
-- `public` and uuid-ossp. Use when migration history was cleared but DDL leftovers remain (e.g.
-- "type UserLocale already exists" on `prisma migrate deploy`).
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
