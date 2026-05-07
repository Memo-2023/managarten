import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * All Cards-marketplace tables live under the `cards` Postgres schema
 * inside `mana_platform`. This keeps the marketplace next to the rest
 * of the per-app data (Mana convention: one schema per product) and
 * lets the per-table FKs reference shared tables (e.g. `auth.users`)
 * via plain text columns without cross-DB JOINs.
 */
export const cardsSchema = pgSchema('cards');
