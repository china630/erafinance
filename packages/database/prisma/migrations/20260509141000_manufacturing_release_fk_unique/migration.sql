-- 1:1 optional links from manufacturing_releases to posting artifacts (Prisma @unique).
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturing_releases_finished_goods_transaction_id_key"
  ON "manufacturing_releases" ("finished_goods_transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturing_releases_finished_goods_stock_movement_id_key"
  ON "manufacturing_releases" ("finished_goods_stock_movement_id");
