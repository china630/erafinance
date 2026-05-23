-- Step 2/2: set default tier after TIER_0 exists (separate migration transaction).

ALTER TABLE organization_subscriptions
  ALTER COLUMN current_tier SET DEFAULT 'TIER_0';
