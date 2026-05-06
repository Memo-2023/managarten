/**
 * Public RSVP page — end-to-end smoke test.
 *
 * Bypasses the host's JWT publish flow by seeding events.events_published
 * directly in Postgres, then exercises the unauthenticated /rsvp/[token]
 * page like a real guest would.
 *
 * Requires: Postgres + mana-events service running. Both are booted by
 * the playwright.config.ts webServer block in local dev.
 */

import { test, expect } from '@playwright/test';
import postgres from 'postgres';

const DATABASE_URL =
	process.env.DATABASE_URL || 'postgresql://mana:devpassword@localhost:5432/mana_platform';
const EVENTS_URL = process.env.PUBLIC_MANA_EVENTS_URL || 'http://localhost:3115';

const sql = postgres(DATABASE_URL, { max: 2 });

const TEST_TOKEN = 'E2E_PUBLIC_RSVP_TOKEN';
const TEST_EVENT_ID = '00000000-0000-0000-0000-000000000e2e';

test.afterAll(async () => {
	await sql`DELETE FROM events.events_published WHERE token = ${TEST_TOKEN}`;
	await sql.end();
});

test.describe('Public RSVP page', () => {
	test.beforeEach(async () => {
		// Wipe + reseed so each test starts clean
		await sql`DELETE FROM events.events_published WHERE token = ${TEST_TOKEN}`;
		const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		const endAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();
		await sql`
			INSERT INTO events.events_published
				(token, event_id, user_id, title, description, location, start_at, end_at, all_day, color)
			VALUES
				(${TEST_TOKEN}, ${TEST_EVENT_ID}, 'e2e-host', 'E2E Public Party',
				 'Bring snacks!', 'Café am See',
				 ${startAt}::timestamptz, ${endAt}::timestamptz, false, '#f43f5e')
		`;
	});

	test('renders the seeded event snapshot', async ({ page }) => {
		await page.goto(`/rsvp/${TEST_TOKEN}`, { waitUntil: 'networkidle' });

		await expect(page.getByRole('heading', { name: 'E2E Public Party' })).toBeVisible();
		await expect(page.getByText('Café am See')).toBeVisible();
		await expect(page.getByText('Bring snacks!')).toBeVisible();
	});

	test('submits an RSVP and shows the success state', async ({ page }) => {
		await page.goto(`/rsvp/${TEST_TOKEN}`, { waitUntil: 'networkidle' });

		// Fill the form (labels rendered in EN because Playwright sends Accept-Language: en)
		await page.getByRole('textbox', { name: /Your name|Dein Name/ }).fill('Tante Erika');
		await page
			.getByRole('textbox', { name: /Email \(optional\)|E-Mail \(optional\)/ })
			.fill('erika@example.com');

		// Status defaults to "yes" — explicit click and bring 2 plus-ones
		await page.getByRole('button', { name: /Ja, komme|Yes, coming/i }).click();
		await page.locator('input[type="range"]').fill('2');

		await page
			.getByRole('textbox', { name: /Note \(optional\)|Notiz \(optional\)/ })
			.fill('Komme erst um 20 Uhr');
		await page.getByRole('button', { name: /Antwort senden|Send reply/i }).click();

		// Success card should appear
		await expect(page.getByRole('heading', { name: /Danke|Thanks/ })).toBeVisible({
			timeout: 5_000,
		});

		// Verify the row landed in Postgres
		const rows = await sql<
			{ name: string; status: string; plus_ones: number; note: string | null }[]
		>`
			SELECT name, status, plus_ones, note
			FROM events.public_rsvps
			WHERE token = ${TEST_TOKEN}
		`;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			name: 'Tante Erika',
			status: 'yes',
			plus_ones: 2,
			note: 'Komme erst um 20 Uhr',
		});
	});

	test('upserts when the same person submits twice', async ({ page }) => {
		const nameField = page.getByRole('textbox', { name: /Your name|Dein Name/ });

		// First submission
		await page.goto(`/rsvp/${TEST_TOKEN}`, { waitUntil: 'networkidle' });
		await nameField.fill('Onkel Klaus');
		await page.getByRole('button', { name: /Vielleicht|Maybe/i }).click();
		await page.getByRole('button', { name: /Antwort senden|Send reply/i }).click();
		await expect(page.getByRole('heading', { name: /Danke|Thanks/i })).toBeVisible();

		// Click "Change answer" to flip back to the form. Svelte 5 keeps the
		// script-scoped $state across the {#if} branches, so name is still
		// "Onkel Klaus" — no need to refill. Just wait for the form input to
		// be visible again before changing the status.
		await page.getByRole('button', { name: /Antwort ändern|Change answer/i }).click();
		await expect(nameField).toBeVisible();
		await page.getByRole('button', { name: /✕ Nein|✕ No/i }).click();
		await page.getByRole('button', { name: /Antwort senden|Send reply/i }).click();
		await expect(page.getByRole('heading', { name: /Danke|Thanks/i })).toBeVisible();

		// DB should still have exactly one row for Klaus, status now 'no'
		const rows = await sql<{ status: string }[]>`
			SELECT status FROM events.public_rsvps
			WHERE token = ${TEST_TOKEN} AND name = 'Onkel Klaus'
		`;
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe('no');
	});

	test('returns 404 for an unknown token', async ({ page }) => {
		const response = await page.goto('/rsvp/THIS_TOKEN_DOES_NOT_EXIST');
		expect(response?.status()).toBe(404);
	});
});
