/**
 * Personas — DB schema (Drizzle / pgSchema 'personas').
 *
 * Test-infrastructure for the persona-runner (`services/mana-persona-runner`):
 * a Persona is a real Mana user (managed by mana-auth) with extra
 * behavioural metadata describing how the runner should drive them
 * — archetype, system prompt, module mix, tick cadence.
 *
 * Why here (apps/api) and not in mana-auth?
 *   `userId` references mana-auth's `auth.users`, which lives in a
 *   different database after the platform split. Cross-DB FKs aren't
 *   possible, so we own this product-specific schema in mana_platform
 *   and use plain UUIDs as references — the standard cross-service
 *   pattern documented in `Code/mana/docs/PLAN.md` §4.
 *
 * Three tables:
 *   - personas         — per-persona descriptor (one row per user that
 *                        is actually a persona)
 *   - persona_actions  — audit trail of every tool call the runner made
 *   - persona_feedback — 1–5 module ratings the runner emits per tick
 */

import { jsonb, integer, smallint, text, timestamp, index, pgSchema } from 'drizzle-orm/pg-core';

export const personasSchema = pgSchema('personas');

export const personas = personasSchema.table(
	'personas',
	{
		userId: text('user_id').primaryKey(),

		// Denormalized from mana-auth's auth.users.email so the runner's
		// /due endpoint doesn't need a cross-DB join. Set on upsert by
		// the admin route after it creates/finds the user via mana-auth's
		// HTTP API. Kept in sync on email change is out of scope — when
		// it happens, re-upsert the persona.
		email: text('email').notNull(),

		archetype: text('archetype').notNull(),

		systemPrompt: text('system_prompt').notNull(),

		moduleMix: jsonb('module_mix').notNull(),

		tickCadence: text('tick_cadence').notNull().default('daily'),

		lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index('personas_archetype_idx').on(table.archetype)]
);

export const personaActions = personasSchema.table(
	'persona_actions',
	{
		id: text('id').primaryKey(),
		personaId: text('persona_id').notNull(),

		tickId: text('tick_id').notNull(),

		toolName: text('tool_name').notNull(),

		inputHash: text('input_hash'),

		result: text('result').notNull(),
		errorMessage: text('error_message'),

		latencyMs: integer('latency_ms'),

		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('persona_actions_persona_idx').on(table.personaId, table.createdAt),
		index('persona_actions_tick_idx').on(table.tickId),
	]
);

export const personaFeedback = personasSchema.table(
	'persona_feedback',
	{
		id: text('id').primaryKey(),
		personaId: text('persona_id').notNull(),

		tickId: text('tick_id').notNull(),

		module: text('module').notNull(),

		rating: smallint('rating').notNull(),

		notes: text('notes'),

		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('persona_feedback_module_idx').on(table.module, table.createdAt),
		index('persona_feedback_persona_idx').on(table.personaId, table.createdAt),
	]
);
