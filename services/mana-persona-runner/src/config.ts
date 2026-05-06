/**
 * Service configuration. Every value env-overridable so dev/staging/prod
 * can dial them independently without a code change.
 */

export interface Config {
	port: number;

	/** mana-auth base URL — for login + spaces list. */
	authUrl: string;
	/** apps/api base URL — for /api/v1/personas/internal/* callbacks
	 *  (due, actions, feedback). Personas live in mana_platform now,
	 *  not in mana-auth. */
	apiUrl: string;
	/** mana-mcp base URL — where Claude talks to the tool registry. */
	mcpUrl: string;

	/** Service key for /api/v1/personas/internal/* callbacks into apps/api. */
	serviceKey: string;

	/** Anthropic API key that drives each persona's Claude call. */
	anthropicApiKey: string;

	/** Deterministic per-persona password seed. Must match whatever is
	 *  in scripts/personas/password.ts — the same function derives the
	 *  same password here, so the runner can log in without storing any
	 *  per-persona credentials. */
	personaSeedSecret: string;

	/** How often the tick loop runs. Default 60 s — fine-grained enough
	 *  that a persona with tickCadence='hourly' stays on schedule, cheap
	 *  enough that dispatching 10 personas never backs up. */
	tickIntervalMs: number;

	/** Max personas running in parallel per tick. Scoped to Claude API
	 *  rate limits — conservative default 2, tier-dependent. */
	concurrency: number;

	/**
	 * Pause the loop without redeploying. Useful when the user wants
	 * persona activity to stop (e.g. during a demo) but the service
	 * should stay up so health checks don't page.
	 */
	paused: boolean;
}

function intEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const n = Number(raw);
	if (!Number.isInteger(n) || n <= 0) {
		throw new Error(`${name} must be a positive integer, got "${raw}"`);
	}
	return n;
}

function boolEnv(name: string, fallback: boolean): boolean {
	const raw = process.env[name];
	if (raw == null) return fallback;
	return raw === '1' || raw.toLowerCase() === 'true';
}

export function loadConfig(): Config {
	return {
		port: intEnv('PORT', 3070),
		authUrl: process.env.MANA_AUTH_URL ?? 'http://localhost:3001',
		apiUrl: process.env.MANA_API_URL ?? 'http://localhost:3060',
		mcpUrl: process.env.MANA_MCP_URL ?? 'http://localhost:3069',
		serviceKey: process.env.MANA_SERVICE_KEY ?? '',
		anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
		personaSeedSecret: process.env.PERSONA_SEED_SECRET ?? 'dev-persona-seed-secret-rotate-in-prod',
		tickIntervalMs: intEnv('TICK_INTERVAL_MS', 60_000),
		concurrency: intEnv('PERSONA_CONCURRENCY', 2),
		paused: boolEnv('RUNNER_PAUSED', false),
	};
}

export function assertProductionSecrets(config: Config): void {
	if (process.env.NODE_ENV !== 'production') return;
	const missing: string[] = [];
	if (!config.serviceKey) missing.push('MANA_SERVICE_KEY');
	if (!config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
	if (config.personaSeedSecret === 'dev-persona-seed-secret-rotate-in-prod') {
		missing.push('PERSONA_SEED_SECRET (dev fallback in prod)');
	}
	if (missing.length > 0) {
		throw new Error(
			`mana-persona-runner production start blocked — missing/unsafe: ${missing.join(', ')}`
		);
	}
}
