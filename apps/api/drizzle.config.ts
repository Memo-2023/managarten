import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle config for the unified mana-api.
 *
 * Managed schemas accumulate as modules adopt managed migrations. Each
 * schema's generated SQL lives under `drizzle/{schema}/`. Expand the
 * `schema` array and `schemaFilter` when a new module joins.
 *
 * Currently managed: `research`, `website`, `unlisted`, `personas`.
 */
export default defineConfig({
	schema: [
		'./src/modules/research/schema.ts',
		'./src/modules/website/schema.ts',
		'./src/modules/unlisted/schema.ts',
		'./src/modules/personas/schema.ts',
	],
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL || 'postgresql://mana:devpassword@localhost:5432/mana_platform',
	},
	schemaFilter: ['research', 'website', 'unlisted', 'personas'],
});
