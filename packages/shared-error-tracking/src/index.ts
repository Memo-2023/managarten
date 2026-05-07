/**
 * Shared Error Tracking for Mana Apps
 *
 * Uses Sentry SDK with GlitchTip as the self-hosted backend.
 * Compatible with any Sentry-compatible error tracking service.
 *
 * @example
 * ```typescript
 * // In instrument.ts (must be imported BEFORE app bootstrap)
 * import { initErrorTracking } from '@mana/shared-error-tracking';
 *
 * initErrorTracking({
 *   serviceName: 'calendar-backend',
 *   dsn: process.env.GLITCHTIP_DSN,
 *   environment: process.env.NODE_ENV,
 *   release: process.env.APP_VERSION,
 * });
 * ```
 */

import * as Sentry from '@sentry/node';

export interface ErrorTrackingOptions {
	/** Service/app name (e.g. 'calendar-backend', 'contacts-web') */
	serviceName: string;
	/** GlitchTip/Sentry DSN. If not set, error tracking is disabled. */
	dsn?: string;
	/** Environment (development, staging, production) */
	environment?: string;
	/** Release/version string */
	release?: string;
	/** Sample rate for error events (0.0 to 1.0, default: 1.0) */
	sampleRate?: number;
	/** Sample rate for performance traces (0.0 to 1.0, default: 0.1) */
	tracesSampleRate?: number;
	/** Enable debug mode (default: false) */
	debug?: boolean;
}

let initialized = false;

/**
 * Initialize error tracking. Call this BEFORE bootstrapping your app.
 * If no DSN is provided, error tracking is silently disabled.
 */
export function initErrorTracking(options: ErrorTrackingOptions): void {
	if (initialized) return;

	const rawDsn = options.dsn || process.env.GLITCHTIP_DSN || process.env.SENTRY_DSN;

	if (!rawDsn) {
		if (options.debug) {
			console.log(`[ErrorTracking] No DSN configured for ${options.serviceName} - disabled`);
		}
		return;
	}

	// Glitchtip projects use UUID-format public_keys (`556fbd2e-a720-...`)
	// but @sentry/node v9's DSN parser only accepts alphanumeric — dashes
	// trip "Invalid Sentry Dsn" and silently disable transport. Strip them
	// from the user/key portion only; the wire format accepts both.
	const dsn = rawDsn.replace(/^(https?:\/\/)([\w-]+)(@.+)$/, (_, proto, key, rest) => {
		return proto + key.replace(/-/g, '') + rest;
	});

	Sentry.init({
		dsn,
		environment: options.environment || process.env.NODE_ENV || 'development',
		release: options.release || process.env.APP_VERSION,
		serverName: options.serviceName,
		sampleRate: options.sampleRate ?? 1.0,
		tracesSampleRate: options.tracesSampleRate ?? 0.1,
		debug: options.debug ?? false,
	});

	initialized = true;

	console.log(
		`[ErrorTracking] Initialized for ${options.serviceName} (${options.environment || 'development'})`
	);
}

/**
 * Capture an exception manually
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
	if (!initialized) return;
	Sentry.captureException(error, { extra: context });
}

/**
 * Capture a message
 */
export function captureMessage(
	message: string,
	level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
	if (!initialized) return;
	Sentry.captureMessage(message, level);
}

/**
 * Set user context for error reports
 */
export function setUser(user: { id: string; email?: string } | null): void {
	if (!initialized) return;
	Sentry.setUser(user);
}

/**
 * Set extra context tags
 */
export function setTag(key: string, value: string): void {
	if (!initialized) return;
	Sentry.setTag(key, value);
}

/**
 * Flush pending events (call before process exit)
 */
export async function flush(timeout = 2000): Promise<void> {
	if (!initialized) return;
	await Sentry.flush(timeout);
}

export { Sentry };
