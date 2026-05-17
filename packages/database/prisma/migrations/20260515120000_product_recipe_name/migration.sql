-- ProductRecipe display name (master-detail UI)
ALTER TABLE "product_recipes" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';

UPDATE "product_recipes" pr
SET "name" = p."name"
FROM "products" p
WHERE p."id" = pr."finished_product_id"
  AND (pr."name" IS NULL OR pr."name" = '');
