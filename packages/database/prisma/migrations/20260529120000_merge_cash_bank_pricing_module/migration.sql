-- Merge kassa_pro + banking_pro into single catalog module cash_bank_pro (idempotent).

DO $body$
DECLARE
  merged_price numeric(12, 2);
BEGIN
  SELECT COALESCE(
    (SELECT price_per_month FROM pricing_modules WHERE key = 'cash_bank_pro' LIMIT 1),
    (
      SELECT COALESCE(SUM(price_per_month), 38)
      FROM pricing_modules
      WHERE key IN ('kassa_pro', 'banking_pro')
    ),
    38
  )
  INTO merged_price;

  IF NOT EXISTS (SELECT 1 FROM pricing_modules WHERE key = 'cash_bank_pro') THEN
    INSERT INTO pricing_modules (id, key, name, price_per_month, sort_order, created_at, updated_at)
    VALUES (
      uuid_generate_v4(),
      'cash_bank_pro',
      'Cash & Bank Pro',
      merged_price,
      0,
      now(),
      now()
    );
  ELSE
    UPDATE pricing_modules
    SET
      name = 'Cash & Bank Pro',
      price_per_month = merged_price,
      sort_order = LEAST(sort_order, 0),
      updated_at = now()
    WHERE key = 'cash_bank_pro';
  END IF;
END $body$;

-- pricing_bundles.module_keys: replace legacy slugs with cash_bank_pro
WITH mapped AS (
  SELECT
    pb.id,
    CASE
      WHEN elem IN ('kassa_pro', 'banking_pro', 'kassa') THEN 'cash_bank_pro'
      ELSE elem
    END AS k
  FROM pricing_bundles pb,
    LATERAL jsonb_array_elements_text(pb.module_keys::jsonb) AS elem
),
agg AS (
  SELECT id, jsonb_agg(to_jsonb(k) ORDER BY k) AS mk
  FROM (SELECT DISTINCT id, k FROM mapped) deduped
  GROUP BY id
)
UPDATE pricing_bundles pb
SET module_keys = agg.mk, updated_at = now()
FROM agg
WHERE pb.id = agg.id
  AND pb.module_keys::jsonb IS DISTINCT FROM agg.mk;

-- organization_subscriptions.active_modules (text[])
UPDATE organization_subscriptions os
SET active_modules = sub.normalized
FROM (
  SELECT
    organization_id,
    COALESCE(
      (
        SELECT array_agg(DISTINCT elem ORDER BY elem)
        FROM unnest(
          array_cat(
            array_remove(
              array_remove(array_remove(os2.active_modules, 'kassa_pro'), 'banking_pro'),
              'kassa'
            ),
            CASE
              WHEN os2.active_modules && ARRAY['cash_bank_pro', 'kassa_pro', 'banking_pro', 'kassa']::text[]
              THEN ARRAY['cash_bank_pro']::text[]
              ELSE ARRAY[]::text[]
            END
          )
        ) AS elem
        WHERE elem IS NOT NULL AND elem <> ''
      ),
      ARRAY[]::text[]
    ) AS normalized
  FROM organization_subscriptions os2
) sub
WHERE os.organization_id = sub.organization_id
  AND os.active_modules IS DISTINCT FROM sub.normalized;

-- organizations.active_modules
UPDATE organizations o
SET active_modules = sub.normalized
FROM (
  SELECT
    id,
    COALESCE(
      (
        SELECT array_agg(DISTINCT elem ORDER BY elem)
        FROM unnest(
          array_cat(
            array_remove(
              array_remove(array_remove(o2.active_modules, 'kassa_pro'), 'banking_pro'),
              'kassa'
            ),
            CASE
              WHEN o2.active_modules && ARRAY['cash_bank_pro', 'kassa_pro', 'banking_pro', 'kassa']::text[]
              THEN ARRAY['cash_bank_pro']::text[]
              ELSE ARRAY[]::text[]
            END
          )
        ) AS elem
        WHERE elem IS NOT NULL AND elem <> ''
      ),
      ARRAY[]::text[]
    ) AS normalized
  FROM organizations o2
) sub
WHERE o.id = sub.id
  AND o.active_modules IS DISTINCT FROM sub.normalized;

-- organization_modules: merge legacy rows into cash_bank_pro
DO $body$
DECLARE
  org uuid;
  snap numeric(12, 2);
  act timestamptz;
  pend boolean;
  canc timestamptz;
  acc timestamptz;
BEGIN
  FOR org IN
    SELECT DISTINCT organization_id
    FROM organization_modules
    WHERE module_key IN ('kassa_pro', 'banking_pro', 'kassa', 'cash_bank_pro')
  LOOP
    SELECT COALESCE(SUM(price_snapshot), 0)
    INTO snap
    FROM organization_modules
    WHERE organization_id = org
      AND module_key IN ('kassa_pro', 'banking_pro', 'kassa', 'cash_bank_pro');

    SELECT MIN(activated_at)
    INTO act
    FROM organization_modules
    WHERE organization_id = org
      AND module_key IN ('kassa_pro', 'banking_pro', 'kassa', 'cash_bank_pro');

    SELECT bool_or(pending_deactivation)
    INTO pend
    FROM organization_modules
    WHERE organization_id = org
      AND module_key IN ('kassa_pro', 'banking_pro', 'kassa', 'cash_bank_pro');

    SELECT MAX(cancelled_at)
    INTO canc
    FROM organization_modules
    WHERE organization_id = org
      AND module_key IN ('kassa_pro', 'banking_pro', 'kassa', 'cash_bank_pro');

    SELECT MAX(access_until)
    INTO acc
    FROM organization_modules
    WHERE organization_id = org
      AND module_key IN ('kassa_pro', 'banking_pro', 'kassa', 'cash_bank_pro');

    DELETE FROM organization_modules
    WHERE organization_id = org
      AND module_key IN ('kassa_pro', 'banking_pro', 'kassa');

    IF EXISTS (
      SELECT 1 FROM organization_modules
      WHERE organization_id = org AND module_key = 'cash_bank_pro'
    ) THEN
      UPDATE organization_modules
      SET
        price_snapshot = GREATEST(price_snapshot, snap),
        activated_at = LEAST(activated_at, act),
        pending_deactivation = COALESCE(pend, false),
        cancelled_at = canc,
        access_until = acc
      WHERE organization_id = org AND module_key = 'cash_bank_pro';
    ELSIF snap > 0 OR act IS NOT NULL THEN
      INSERT INTO organization_modules (
        organization_id,
        module_key,
        price_snapshot,
        activated_at,
        pending_deactivation,
        cancelled_at,
        access_until
      )
      VALUES (org, 'cash_bank_pro', snap, COALESCE(act, now()), COALESCE(pend, false), canc, acc)
      ON CONFLICT (organization_id, module_key) DO NOTHING;
    END IF;
  END LOOP;
END $body$;

DELETE FROM pricing_modules WHERE key IN ('kassa_pro', 'banking_pro');
