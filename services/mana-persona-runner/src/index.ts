/**
 * mana-persona-runner — tick-loop service that drives persona accounts
 * through Claude + MCP.
 *
 * Scope of this file today (M3.a scaffold):
 *   - bootstrap Hono on :3070
 *   - /health, /metrics stub, /diag/login (dev-only: prove login works)
 *   - no tick loop yet — that lands in M3.b, along with the Claude + MCP
 *     integration
 *
 * Plan: docs/plans/mana-mcp-and-personas.md (M3).
 */

import { Hono } from 'hono';
import { AuthClient } from './clients/auth.ts';
import { ManaAuthInternalClient } from './clients/mana-auth-internal.ts';
import { loadConfig, assertProductionSecrets } from './config.ts';
import { personaPassword } from './password.ts';
import { tick } from './runner/tick.ts';

const config = loadConfig();
assertProductionSecrets(config);

const authClient = new AuthClient(config.authUrl);
const internalClient = config.serviceKey
	? new ManaAuthInternalClient(config.apiUrl, config.serviceKey)
	: null;

const app = new Hono();

// ─── Health / metrics ─────────────────────────────────────────────

app.get('/health', (c) =>
	c.json({
		status: 'ok',
		service: 'mana-persona-runner',
		paused: config.paused,
		tickIntervalMs: config.tickIntervalMs,
		concurrency: config.concurrency,
	})
);

app.get('/metrics', (c) =>
	c.text('# mana-persona-runner metrics stub — populated alongside the tick loop in M3.b\n')
);

// ─── Dev diagnostics ──────────────────────────────────────────────
//
// `/diag/login?email=persona.anna@mana.test` lets a developer verify
// the password derivation + mana-auth wiring end-to-end without
// spinning up the full tick loop. Only responds in non-production.

app.get('/diag/login', async (c) => {
	if (process.env.NODE_ENV === 'production') {
		return c.json({ error: 'diagnostics disabled in production' }, 404);
	}
	const email = c.req.query('email');
	if (!email) return c.json({ error: 'email query required' }, 400);
	try {
		const password = personaPassword(email, config.personaSeedSecret);
		const { userId, spaceId } = await authClient.loginAndResolvePersonalSpace(email, password);
		return c.json({ ok: true, email, userId, spaceId });
	} catch (err) {
		return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
	}
});

// ─── Manual tick endpoint (dev-only, lets us verify without waiting) ──

app.post('/diag/tick', async (c) => {
	if (process.env.NODE_ENV === 'production') {
		return c.json({ error: 'diagnostics disabled in production' }, 404);
	}
	if (!internalClient) {
		return c.json({ error: 'MANA_SERVICE_KEY not set — cannot call internal endpoints' }, 500);
	}
	if (!config.anthropicApiKey) {
		return c.json({ error: 'ANTHROPIC_API_KEY not set — Claude would fail' }, 500);
	}
	try {
		const result = await tick({ config, auth: authClient, internal: internalClient });
		return c.json({ ok: true, result });
	} catch (err) {
		return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
	}
});

// ─── Tick loop ────────────────────────────────────────────────────

let tickTimer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;
let tickCount = 0;

function startTickLoop(): void {
	if (!internalClient) {
		console.warn(
			'[mana-persona-runner] MANA_SERVICE_KEY missing — tick loop disabled. /diag/login still works.'
		);
		return;
	}
	if (!config.anthropicApiKey) {
		console.warn(
			'[mana-persona-runner] ANTHROPIC_API_KEY missing — tick loop disabled. Set it to drive personas.'
		);
		return;
	}
	if (config.paused) {
		console.info('[mana-persona-runner] RUNNER_PAUSED=true — tick loop started in paused mode');
	}

	tickTimer = setInterval(async () => {
		if (config.paused) return;
		if (tickInFlight) {
			// Overlapping ticks would double-log. If a tick takes longer
			// than the interval (rare, but possible with Claude latency),
			// skip rather than queue.
			return;
		}
		tickInFlight = true;
		try {
			tickCount++;
			const result = await tick({ config, auth: authClient, internal: internalClient! });
			if (result.due > 0 || result.failed.length > 0) {
				console.info(
					`[tick #${tickCount}] due=${result.due} ok=${result.ranSuccessfully} failed=${result.failed.length} ${result.durationMs}ms`
				);
				for (const f of result.failed) {
					console.error(`  ✗ ${f.persona}: ${f.error}`);
				}
			}
		} catch (err) {
			console.error('[tick] unhandled error', err);
		} finally {
			tickInFlight = false;
		}
	}, config.tickIntervalMs);
}

startTickLoop();

// ─── Server ───────────────────────────────────────────────────────

console.info(
	`[mana-persona-runner] listening on :${config.port} ` +
		`(auth=${config.authUrl} mcp=${config.mcpUrl} paused=${config.paused} ` +
		`tick=${config.tickIntervalMs}ms concurrency=${config.concurrency})`
);

// Graceful shutdown — stops the tick interval so an orchestrator
// doesn't see a phantom tick after SIGTERM.
function shutdown(signal: string): void {
	console.info(`[mana-persona-runner] ${signal} — stopping tick loop`);
	if (tickTimer) clearInterval(tickTimer);
	process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default {
	port: config.port,
	fetch: app.fetch,
};
