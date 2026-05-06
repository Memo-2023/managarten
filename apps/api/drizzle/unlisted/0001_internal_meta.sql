-- M10d — internal_meta column on unlisted snapshots.
--
-- Owner-private metadata for headless server-side jobs (forms wave-
-- cron, future). The public GET endpoint MUST strip this column
-- before returning — recipients + sender-details belong here so
-- they don't leak via the public share-link.
--
-- Apply with:
--   docker exec -i mana-postgres psql -U mana -d mana_platform \
--     < apps/api/drizzle/unlisted/0001_internal_meta.sql

ALTER TABLE "unlisted"."snapshots"
	ADD COLUMN IF NOT EXISTS "internal_meta" jsonb;
