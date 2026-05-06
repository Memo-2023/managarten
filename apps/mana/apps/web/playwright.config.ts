import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the unified Mana web app.
 *
 * Tests live in ./e2e and exercise the Svelte 5 routes against a local
 * dev server. Postgres + Redis + MinIO must be running (`pnpm docker:up`
 * from the monorepo root). The webServer block boots both the SvelteKit
 * dev server and the mana-events backend so RSVP flows can be exercised
 * end to end.
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: false, // Tests share IndexedDB / Postgres state
	forbidOnly: !!process.env.CI,
	// Local: 1 retry to absorb cold-start HMR flakes (Vite recompiling
	// during the first navigation). CI uses 2 retries.
	retries: process.env.CI ? 2 : 1,
	workers: 1,
	// Default per-test timeout 30s — bumped to 60s so a Vite cold compile
	// during the first test of a fresh dev server doesn't time out.
	timeout: 60_000,
	expect: {
		// Default 5s — bumped so locator polls survive a single HMR pause.
		timeout: 10_000,
	},
	reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

	use: {
		baseURL: process.env.BASE_URL || 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		// Wait until Vite has finished any in-flight HMR before navigating.
		navigationTimeout: 30_000,
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	webServer: process.env.CI
		? undefined
		: [
				{
					command: 'cd ../../../../services/mana-auth && bun run src/index.ts',
					url: 'http://localhost:3001/health',
					reuseExistingServer: true,
					timeout: 60_000,
				},
				{
					command: 'pnpm dev',
					url: 'http://localhost:5173',
					reuseExistingServer: true,
					timeout: 120_000,
				},
				{
					command: 'cd ../../../../services/mana-events && bun run src/index.ts',
					url: 'http://localhost:3115/health',
					reuseExistingServer: true,
					timeout: 60_000,
					env: {
						PORT: '3115',
						DATABASE_URL:
							process.env.DATABASE_URL ||
							'postgresql://mana:devpassword@localhost:5432/mana_platform',
						MANA_AUTH_URL: 'http://localhost:3001',
						CORS_ORIGINS: 'http://localhost:5173',
					},
				},
			],
});
