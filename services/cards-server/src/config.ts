/**
 * Runtime config — read once at startup, validated with sensible
 * dev-friendly defaults but loud in prod when secrets are missing.
 */

export interface Config {
	port: number;
	databaseUrl: string;
	manaAuthUrl: string;
	manaCreditsUrl: string;
	manaLlmUrl: string;
	manaMediaUrl: string;
	manaNotifyUrl: string;
	serviceKey: string;
	cors: { origins: string[] };
	authorPayout: {
		standardAuthorBps: number;
		verifiedAuthorBps: number;
	};
	communityVerifiedThresholds: {
		stars: number;
		featuredDecks: number;
		activeSubscribers: number;
	};
}

function getEnv(key: string, fallback?: string): string {
	const v = process.env[key];
	if (v && v.length > 0) return v;
	if (fallback !== undefined) return fallback;
	throw new Error(`Missing required env var: ${key}`);
}

function getEnvNumber(key: string, fallback: number): number {
	const v = process.env[key];
	if (!v) return fallback;
	const n = Number(v);
	if (Number.isNaN(n)) throw new Error(`${key} is not a number: ${v}`);
	return n;
}

export function loadConfig(): Config {
	const inProd = process.env.NODE_ENV === 'production';

	return {
		port: getEnvNumber('PORT', 3072),
		databaseUrl: getEnv(
			'DATABASE_URL',
			inProd ? undefined : 'postgresql://mana:devpassword@localhost:5432/mana_platform'
		),
		manaAuthUrl: getEnv('MANA_AUTH_URL', 'http://localhost:3001'),
		manaCreditsUrl: getEnv('MANA_CREDITS_URL', 'http://localhost:3061'),
		manaLlmUrl: getEnv('MANA_LLM_URL', 'http://localhost:3025'),
		manaMediaUrl: getEnv('MANA_MEDIA_URL', 'http://localhost:3015'),
		manaNotifyUrl: getEnv('MANA_NOTIFY_URL', 'http://localhost:3040'),
		serviceKey: getEnv('MANA_SERVICE_KEY', inProd ? undefined : 'dev-service-key'),
		cors: {
			origins: getEnv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5180').split(','),
		},
		authorPayout: {
			// 80/20 standard, 90/10 for verified-mana authors. Stored in
			// basis-points so we can tune later without code change.
			standardAuthorBps: getEnvNumber('AUTHOR_PAYOUT_STANDARD_BPS', 8000),
			verifiedAuthorBps: getEnvNumber('AUTHOR_PAYOUT_VERIFIED_BPS', 9000),
		},
		communityVerifiedThresholds: {
			stars: getEnvNumber('COMMUNITY_VERIFY_STARS', 500),
			featuredDecks: getEnvNumber('COMMUNITY_VERIFY_FEATURED', 3),
			activeSubscribers: getEnvNumber('COMMUNITY_VERIFY_SUBSCRIBERS', 200),
		},
	};
}
