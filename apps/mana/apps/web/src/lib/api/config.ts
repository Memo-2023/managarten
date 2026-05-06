/**
 * API Configuration
 * Provides runtime-configurable URLs for API calls
 */

import { browser } from '$app/environment';

/**
 * Get the Mana Core Auth URL dynamically at runtime
 * - Client-side: uses injected window variable (set by hooks.server.ts)
 * - Server-side (SSR): uses environment variable
 * - Falls back to localhost for local development
 */
export function getManaAuthUrl(): string {
	if (browser && typeof window !== 'undefined') {
		// Client-side: use injected window variable (set by hooks.server.ts)
		const injectedUrl = (window as unknown as { __PUBLIC_MANA_AUTH_URL__?: string })
			.__PUBLIC_MANA_AUTH_URL__;
		return injectedUrl || 'http://localhost:3001';
	}
	// Server-side (SSR): use environment variable
	return process.env.PUBLIC_MANA_AUTH_URL || 'http://localhost:3001';
}

/**
 * Get the mana-analytics service URL (port 3064 in dev).
 * Hosts the public-community feedback hub.
 */
export function getManaAnalyticsUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_ANALYTICS_URL__?: string })
			.__PUBLIC_MANA_ANALYTICS_URL__;
		return injected || 'http://localhost:3064';
	}
	return process.env.PUBLIC_MANA_ANALYTICS_URL || 'http://localhost:3064';
}

/**
 * Get the mana-events service URL (Phase 1b: public RSVP backend).
 */
export function getManaEventsUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_EVENTS_URL__?: string })
			.__PUBLIC_MANA_EVENTS_URL__;
		return injected || 'http://localhost:3115';
	}
	return process.env.PUBLIC_MANA_EVENTS_URL || 'http://localhost:3115';
}

/**
 * Get the unified mana-api URL (Hono/Bun, port 3060 in dev).
 * Hosts module-specific compute endpoints under /api/v1/{module}/*.
 */
export function getManaApiUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_API_URL__?: string })
			.__PUBLIC_MANA_API_URL__;
		return injected || 'http://localhost:3060';
	}
	return process.env.PUBLIC_MANA_API_URL || 'http://localhost:3060';
}

/**
 * Get the mana-credits service URL.
 * Hosts credit balance, packages, transactions, gift codes, sync billing.
 */
export function getManaCreditsUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_CREDITS_URL__?: string })
			.__PUBLIC_MANA_CREDITS_URL__;
		return injected || 'http://localhost:3061';
	}
	return process.env.PUBLIC_MANA_CREDITS_URL || 'http://localhost:3061';
}

/**
 * Get the mana-ai service URL.
 * Hosts the background Mission Runner, decrypt-audit read endpoint,
 * Prometheus metrics.
 */
export function getManaAiUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_AI_URL__?: string })
			.__PUBLIC_MANA_AI_URL__;
		return injected || 'http://localhost:3067';
	}
	return process.env.PUBLIC_MANA_AI_URL || 'http://localhost:3067';
}

/**
 * Get the mana-research service URL (Bun/Hono, port 3068 in dev).
 * Hosts the unified web-research provider orchestration — search, extract,
 * and research-agent endpoints with side-by-side comparison support.
 */
export function getManaResearchUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_RESEARCH_URL__?: string })
			.__PUBLIC_MANA_RESEARCH_URL__;
		return injected || 'http://localhost:3068';
	}
	return process.env.PUBLIC_MANA_RESEARCH_URL || 'http://localhost:3068';
}

/**
 * Feature flag for the AI Mission Key-Grant UI. When false, the consent
 * dialog + "Server-Zugriff" box are hidden even on missions with
 * encrypted inputs — missions simply stay foreground-only. Flip on per-
 * deployment after the MANA_AI_PUBLIC/PRIVATE_KEY_PEM keypair is
 * provisioned on both mana-auth and mana-ai.
 */
export function isMissionGrantsEnabled(): boolean {
	if (browser && typeof window !== 'undefined') {
		const flag = (window as unknown as { __PUBLIC_AI_MISSION_GRANTS__?: string })
			.__PUBLIC_AI_MISSION_GRANTS__;
		return flag === 'true';
	}
	return process.env.PUBLIC_AI_MISSION_GRANTS === 'true';
}

/**
 * Get the mana-mail service URL.
 * Hosts mail threads, send, labels, accounts.
 */
export function getManaMailUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_MAIL_URL__?: string })
			.__PUBLIC_MANA_MAIL_URL__;
		return injected || 'http://localhost:3042';
	}
	return process.env.PUBLIC_MANA_MAIL_URL || 'http://localhost:3042';
}
