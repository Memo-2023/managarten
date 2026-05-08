-- Rename SPDX-style license identifiers from `Cards-*` to `Cardecky-*`.
-- Folgt dem Brand-Rename des Produkts (Cards → Cardecky, 2026-05-08).
-- Phase α (Skelett geshipt 2026-05-07) hat ggf. wenige Datensätze.
--
-- Reihenfolge: erst CHECK droppen, dann UPDATE, dann CHECK neu setzen.
-- Sonst feuert die alte Constraint beim UPDATE der Pro-Only-Decks.

ALTER TABLE "cards"."decks" DROP CONSTRAINT "decks_price_requires_license";

UPDATE "cards"."decks"
SET "license" = 'Cardecky-Personal-Use-1.0'
WHERE "license" = 'Cards-Personal-Use-1.0';

UPDATE "cards"."decks"
SET "license" = 'Cardecky-Pro-Only-1.0'
WHERE "license" = 'Cards-Pro-Only-1.0';

ALTER TABLE "cards"."decks"
ALTER COLUMN "license" SET DEFAULT 'Cardecky-Personal-Use-1.0';

ALTER TABLE "cards"."decks"
ADD CONSTRAINT "decks_price_requires_license"
CHECK (price_credits = 0 OR license = 'Cardecky-Pro-Only-1.0');
