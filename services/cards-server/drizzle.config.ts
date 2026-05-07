import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/db/schema/*.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL || 'postgresql://mana:devpassword@localhost:5432/mana_platform',
	},
	// All Cards-marketplace tables live under the `cards` schema in the
	// shared mana_platform DB — keeps the marketplace state next to the
	// rest of the per-app data instead of creating yet another DB.
	schemaFilter: ['cards'],
});
