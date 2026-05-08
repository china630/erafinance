-- Phase 12: Customs integration portal enum value for sync runs / RPA / Excel.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'IntegrationPortal'
      AND e.enumlabel = 'CUSTOMS'
  ) THEN
    ALTER TYPE "IntegrationPortal" ADD VALUE 'CUSTOMS';
  END IF;
END $$;
