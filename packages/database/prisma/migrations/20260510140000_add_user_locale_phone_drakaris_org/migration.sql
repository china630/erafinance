-- CreateEnum
CREATE TYPE "UserLocale" AS ENUM ('AZ', 'RU');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "locale" "UserLocale" NOT NULL DEFAULT 'AZ';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "drakaris_client_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_drakaris_client_id_key" ON "organizations"("drakaris_client_id");
