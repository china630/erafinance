-- Premium modules (tax_pro, trade_pro, compliance_pro, audit_hub) are not sold via standard bundles.
-- Remove trade_pro from "Trade & operations" if present (idempotent).

DO $body$
DECLARE
  b_id uuid;
  keys jsonb;
  filtered jsonb;
BEGIN
  SELECT id, module_keys::jsonb
  INTO b_id, keys
  FROM pricing_bundles
  WHERE lower(name) = lower('Trade & operations')
  LIMIT 1;

  IF b_id IS NULL OR keys IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(elem)), '[]'::jsonb)
  INTO filtered
  FROM jsonb_array_elements_text(keys) AS elem
  WHERE elem NOT IN ('tax_pro', 'trade_pro', 'compliance_pro', 'audit_hub');

  IF filtered IS DISTINCT FROM keys THEN
    UPDATE pricing_bundles
    SET module_keys = filtered, updated_at = now()
    WHERE id = b_id;
  END IF;
END $body$;
