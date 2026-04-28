/**
 * Prometheus metrics for mana-api.
 *
 * Follows the same shape as mana-ai (default metrics with a service
 * prefix, plus module-specific counters / histograms). Scraped from
 * GET /metrics — mounted unauthenticated since the surface is
 * internal-network only.
 *
 * Naming convention: `mana_api_<module>_*`. Underscore separators,
 * standard Prometheus regex `[a-zA-Z_:][a-zA-Z0-9_:]*`.
 */

import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();
register.setDefaultLabels({ service: 'mana-api' });
collectDefaultMetrics({ register, prefix: 'mana_api_' });

// ── Website module ──────────────────────────────────────

/**
 * Every call to POST /sites/:id/publish. `result` labels:
 *   - `success`     — snapshot stored, is_current flipped
 *   - `slug_taken`  — another site already has this slug live
 *   - `invalid`     — validation error (bad slug, missing fields)
 *   - `error`       — unexpected failure (DB, network)
 */
export const websitePublishTotal = new Counter({
	name: 'mana_api_website_publish_total',
	help: 'Publish attempts against the website module.',
	labelNames: ['result'] as const,
	registers: [register],
});

export const websitePublishDuration = new Histogram({
	name: 'mana_api_website_publish_duration_seconds',
	help: 'End-to-end latency of the publish flow (validation + DB transaction).',
	buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
	registers: [register],
});

/**
 * Form submissions received on the public endpoint. `result` labels:
 *   - `received`    — stored in submissions table
 *   - `spam`        — honeypot tripped, silent-dropped
 *   - `rate_limit`  — IP rate-limit hit
 *   - `not_found`   — slug or block missing
 *   - `invalid`     — payload validation failed
 */
export const websiteSubmissionsTotal = new Counter({
	name: 'mana_api_website_submissions_total',
	help: 'Form submissions received on the website submit endpoint.',
	labelNames: ['result'] as const,
	registers: [register],
});

/**
 * Host resolver lookups from hooks.server.ts. `result` labels:
 *   - `hit`   — verified binding found, slug returned
 *   - `miss`  — hostname not bound, 404
 *   - `error` — DB error
 */
export const websiteHostResolveTotal = new Counter({
	name: 'mana_api_website_host_resolve_total',
	help: 'Custom-host to slug resolutions hit / miss.',
	labelNames: ['result'] as const,
	registers: [register],
});

/**
 * DNS verification runs. `result`:
 *   - `verified` — both TXT + CNAME/A matched
 *   - `failed`   — at least one check failed; reason in logs
 */
export const websiteDomainVerifyTotal = new Counter({
	name: 'mana_api_website_domain_verify_total',
	help: 'Custom-domain DNS verification attempts.',
	labelNames: ['result'] as const,
	registers: [register],
});

/**
 * Public snapshot reads — how many visitors hit /public/sites/:slug.
 * `result`:
 *   - `hit`    — snapshot served
 *   - `not_found` — unpublished or unknown slug
 */
export const websitePublicReadsTotal = new Counter({
	name: 'mana_api_website_public_reads_total',
	help: 'Reads of the public /public/sites/:slug endpoint.',
	labelNames: ['result'] as const,
	registers: [register],
});

/**
 * Cache-header guidance for operators: how often public reads return
 * a cache-purge-worthy freshly-published blob vs a routine read. We
 * emit this via header inspection in the public route; `purge_needed`
 * is a heuristic (new-snapshot age < 10s).
 */
export const websitePublicReadAge = new Histogram({
	name: 'mana_api_website_public_read_age_seconds',
	help: 'Age of the served snapshot at read time (seconds since publishedAt).',
	buckets: [1, 10, 60, 300, 1800, 3600, 21600, 86400],
	registers: [register],
});

// ── Articles bulk-import worker ─────────────────────────

/**
 * Every worker tick, regardless of outcome. `result`:
 *   - `processed` — lock acquired, jobs scanned
 *   - `skipped`   — advisory lock taken by another instance
 *   - `error`     — tick threw (logged + rethrown)
 */
export const articlesImportTicksTotal = new Counter({
	name: 'mana_api_articles_import_ticks_total',
	help: 'Articles bulk-import worker tick outcomes.',
	labelNames: ['result'] as const,
	registers: [register],
});

/**
 * Each per-item terminal-state transition the worker observes.
 * `result`:
 *   - `extracted`    — server fetch + Readability succeeded, pickup row written
 *   - `error`        — 3 attempts exhausted, item parked as 'error'
 *   - `consent_wall` — extracted but flagged probable_consent_wall
 *   - `cancelled`    — flipped from pending → cancelled because parent
 *                      job was cancelled mid-flight
 */
export const articlesImportItemsTotal = new Counter({
	name: 'mana_api_articles_import_items_total',
	help: 'Articles bulk-import items by terminal-from-worker state.',
	labelNames: ['result'] as const,
	registers: [register],
});

/**
 * End-to-end latency of one extractFromUrl call (network fetch +
 * JSDOM parse + Readability). Exclude consent-wall flagging — that's
 * a synchronous post-process. Buckets cover anything from a snappy
 * blog (250ms) to the shared-rss timeout ceiling (15s).
 */
export const articlesImportExtractDuration = new Histogram({
	name: 'mana_api_articles_import_extract_duration_seconds',
	help: 'extractFromUrl roundtrip time inside the bulk-import worker.',
	buckets: [0.25, 0.5, 1, 2, 4, 8, 15, 30],
	registers: [register],
});

/**
 * Job-completion counter. `result`:
 *   - `done`      — every item terminal, status flipped to done
 *   - `cancelled` — user cancelled before completion
 */
export const articlesImportJobsCompletedTotal = new Counter({
	name: 'mana_api_articles_import_jobs_completed_total',
	help: 'Articles bulk-import jobs by terminal status.',
	labelNames: ['result'] as const,
	registers: [register],
});

/**
 * Pickup-row GC sweep — how many stale rows were hard-deleted on each
 * 30-tick run. Steady-state should be 0 (consumer drains them within
 * seconds); a non-zero value over time signals a stuck consumer
 * somewhere (closed tabs, broken Web-Lock).
 */
export const articlesImportPickupGcRows = new Counter({
	name: 'mana_api_articles_import_pickup_gc_rows_total',
	help: 'articleExtractPickup rows hard-deleted by the worker GC sweep.',
	registers: [register],
});
