-- Allow multiple tariff revisions per HS prefix: unique (hs_code, effective_from).
-- Lookup uses effective_from / effective_to windows; overlapping rows for the same hs_code
-- are resolved by taking the row with the latest effective_from <= as-of date (see API).

DROP INDEX IF EXISTS "customs_tariff_rates_hs_code_key";

DROP INDEX IF EXISTS "customs_tariff_rates_hs_code_effective_from_idx";

CREATE UNIQUE INDEX "customs_tariff_rates_hs_code_effective_from_key" ON "customs_tariff_rates" ("hs_code", "effective_from");
