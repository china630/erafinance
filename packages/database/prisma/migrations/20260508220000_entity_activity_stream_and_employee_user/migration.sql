-- Activity stream / chatter (PRD §5.E.2) + Employee.userId for PSA (§5.E.7) + UserRole DIRECTOR (§5.E.4).

CREATE TABLE IF NOT EXISTS "entity_activities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "verb" VARCHAR(32) NOT NULL,
    "summary" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entity_activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entity_activities_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entity_activities_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "entity_activities_org_entity_idx"
  ON "entity_activities" ("organization_id", "entity_type", "entity_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "entity_comments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "deleted_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entity_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entity_comments_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entity_comments_author_user_id_fkey"
      FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "entity_comments_org_entity_idx"
  ON "entity_comments" ("organization_id", "entity_type", "entity_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "entity_comment_mentions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "comment_id" UUID NOT NULL,
    "mentioned_user_id" UUID NOT NULL,
    CONSTRAINT "entity_comment_mentions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entity_comment_mentions_comment_id_fkey"
      FOREIGN KEY ("comment_id") REFERENCES "entity_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entity_comment_mentions_mentioned_user_id_fkey"
      FOREIGN KEY ("mentioned_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entity_comment_mentions_comment_id_mentioned_user_id_key" UNIQUE ("comment_id", "mentioned_user_id")
);

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "user_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_user_id_fkey'
  ) THEN
    ALTER TABLE "employees"
      ADD CONSTRAINT "employees_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "employees_user_id_idx" ON "employees" ("user_id");

DO $$
BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'DIRECTOR';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
