/**
 * Actor attribution — the type carried on every DomainEvent, pending-
 * change row, and sync_changes row in the Mana system.
 *
 * The three kinds (user/ai/system) are discriminators for UI + revert
 * semantics; `principalId` is the identity under the kind. For a human
 * writing, `principalId = userId`. For an AI agent, `principalId =
 * agentId`. For system writes, it is one of the `SystemSource` sentinel
 * strings (see below).
 *
 * `displayName` is cached at write time so historical records show
 * "Cashflow Watcher" forever — even after the agent is renamed or
 * deleted. This keeps timelines honest: old events describe what the
 * user actually saw when they happened.
 *
 * Runtime helpers (runAs, ambient context) live in the webapp —
 * browser single-threaded semantics + module-level mutable state,
 * neither of which is appropriate for the server-side mana-ai service.
 * This file exposes only the types, factories, and pure predicates so
 * both runtimes can parse/build identical actor shapes.
 */

export type ActorKind = 'user' | 'ai' | 'system';

/**
 * Fixed set of system-write sources. Each gets its own stable
 * `principalId` so Workbench filters, revert logic, and forensics can
 * distinguish projection writes from migration writes from the
 * mission-runner's server-produced iterations.
 */
export const SYSTEM_PROJECTION = 'system:projection';
export const SYSTEM_RULE = 'system:rule';
export const SYSTEM_MIGRATION = 'system:migration';
export const SYSTEM_STREAM = 'system:stream';
export const SYSTEM_MISSION_RUNNER = 'system:mission-runner';
/**
 * Client-side singleton bootstrap. Stamped on the rare race-window
 * `getOrCreateLocalDoc()` insert in `userContextStore` — a structural
 * twin of mana-auth's server-side bootstrap (which uses the
 * `'system:bootstrap'` principalId on the wire). Maps to
 * `origin='system'` via `originFromActor`, so the conflict-gate exempts
 * it from the user-write codepath.
 */
export const SYSTEM_BOOTSTRAP = 'system:bootstrap';
/**
 * Server-side bulk-article-import worker (apps/api). Picks up
 * articleImportItems with state='pending', runs Readability, drops
 * the extracted payload into articleExtractPickup, flips item state.
 * Every state-transition write the worker does is attributed to this
 * principal so the Workbench timeline + revert path can group
 * background-import writes under one identity.
 *
 * Plan: docs/plans/articles-bulk-import.md.
 */
export const SYSTEM_ARTICLES_IMPORT_WORKER = 'system:articles-import-worker';

export type SystemSource =
	| typeof SYSTEM_PROJECTION
	| typeof SYSTEM_RULE
	| typeof SYSTEM_MIGRATION
	| typeof SYSTEM_STREAM
	| typeof SYSTEM_MISSION_RUNNER
	| typeof SYSTEM_BOOTSTRAP
	| typeof SYSTEM_ARTICLES_IMPORT_WORKER;

/** Legacy sentinels for records that pre-date the identity-aware actor
 *  shape. Read-path normalization maps missing fields to these. */
export const LEGACY_USER_PRINCIPAL = 'legacy:user';
export const LEGACY_AI_PRINCIPAL = 'legacy:ai-default';
export const LEGACY_SYSTEM_PRINCIPAL = 'legacy:system';
export const LEGACY_DISPLAY_NAME = 'Unbekannt';

/** Fields common to every actor kind. */
export interface BaseActor {
	/** UUID / sentinel identifying the specific principal. For kind='user'
	 *  this is the userId; for 'ai' it's the agentId; for 'system' it's
	 *  one of the `SystemSource` sentinels. */
	readonly principalId: string;
	/** Cached display name — frozen at write time so rename doesn't
	 *  rewrite history. */
	readonly displayName: string;
}

export interface UserActor extends BaseActor {
	readonly kind: 'user';
}

export interface AiActor extends BaseActor {
	readonly kind: 'ai';
	/** Mission this write belongs to. */
	readonly missionId: string;
	/** Iteration within the mission (nth autonomous run). */
	readonly iterationId: string;
	/** Human-readable reason the AI took this action. */
	readonly rationale: string;
}

export interface SystemActor extends BaseActor {
	readonly kind: 'system';
}

/** Discriminated union over the three actor kinds. `Extract<Actor,
 *  { kind: 'ai' }>` narrows to `AiActor`. */
export type Actor = UserActor | AiActor | SystemActor;

// ─── Factories ───────────────────────────────────────────────

/**
 * Build a user actor for the given userId. `displayName` defaults to
 * "Du" since the webapp usually doesn't know the user's canonical
 * display name at Dexie-hook time; callers that DO know (e.g. from
 * the auth store) should pass the real value.
 */
export function makeUserActor(userId: string, displayName = 'Du'): UserActor {
	return Object.freeze({ kind: 'user' as const, principalId: userId, displayName });
}

/**
 * Build an agent actor. This is what the mana-ai runner and the
 * webapp's tool executor stamp when an AI agent writes. The mission
 * context is required — a bare "this came from some AI" without
 * mission linkage would hide the agent's work from the revert path.
 */
export function makeAgentActor(args: {
	agentId: string;
	displayName: string;
	missionId: string;
	iterationId: string;
	rationale: string;
}): AiActor {
	return Object.freeze({
		kind: 'ai' as const,
		principalId: args.agentId,
		displayName: args.displayName,
		missionId: args.missionId,
		iterationId: args.iterationId,
		rationale: args.rationale,
	});
}

/**
 * Build a system actor for the given source. `displayName` defaults to
 * a human-readable version of the source; callers rarely need to
 * override this.
 */
export function makeSystemActor(source: SystemSource, displayName?: string): SystemActor {
	return Object.freeze({
		kind: 'system' as const,
		principalId: source,
		displayName: displayName ?? defaultSystemDisplayName(source),
	});
}

function defaultSystemDisplayName(source: SystemSource): string {
	switch (source) {
		case SYSTEM_PROJECTION:
			return 'Projektion';
		case SYSTEM_RULE:
			return 'Regel';
		case SYSTEM_MIGRATION:
			return 'Migration';
		case SYSTEM_STREAM:
			return 'Event-Stream';
		case SYSTEM_MISSION_RUNNER:
			return 'Mission-Runner';
		case SYSTEM_BOOTSTRAP:
			return 'Bootstrap';
		case SYSTEM_ARTICLES_IMPORT_WORKER:
			return 'Artikel-Import';
	}
}

// ─── Read-path compat ────────────────────────────────────────

/**
 * Normalize a raw actor blob that came off the wire (sync_changes.actor,
 * an old DomainEvent, a pre-identity Dexie record) into the current
 * Actor shape. Missing `principalId` / `displayName` get filled with
 * stable `legacy:*` sentinels so downstream code never crashes on
 * historical data.
 *
 * Returns the argument unchanged when it's already a valid Actor — no
 * allocation in the hot path.
 */
export function normalizeActor(raw: unknown): Actor {
	if (!raw || typeof raw !== 'object') {
		return makeUserActor(LEGACY_USER_PRINCIPAL, LEGACY_DISPLAY_NAME);
	}
	const a = raw as Partial<Actor> & { source?: string };

	if (a.kind === 'user') {
		if (typeof a.principalId === 'string' && typeof a.displayName === 'string') {
			return a as Actor;
		}
		return makeUserActor(a.principalId ?? LEGACY_USER_PRINCIPAL, a.displayName ?? 'Du');
	}

	if (a.kind === 'ai') {
		if (typeof a.principalId === 'string' && typeof a.displayName === 'string') {
			return a as Actor;
		}
		return {
			kind: 'ai',
			principalId: a.principalId ?? LEGACY_AI_PRINCIPAL,
			displayName: a.displayName ?? LEGACY_DISPLAY_NAME,
			missionId: a.missionId ?? '',
			iterationId: a.iterationId ?? '',
			rationale: a.rationale ?? '',
		};
	}

	if (a.kind === 'system') {
		// Old shape carried `source: 'projection'|'rule'|'migration'|'mission-runner'`.
		// New shape carries it inside principalId as 'system:<source>'.
		if (typeof a.principalId === 'string' && typeof a.displayName === 'string') {
			return a as Actor;
		}
		const legacySource =
			typeof a.source === 'string' ? `system:${a.source}` : LEGACY_SYSTEM_PRINCIPAL;
		return makeSystemActor(legacySource as SystemSource);
	}

	// Unknown kind → treat as legacy user.
	return makeUserActor(LEGACY_USER_PRINCIPAL, LEGACY_DISPLAY_NAME);
}

// ─── Predicates ──────────────────────────────────────────────

export function isUserActor(actor: Actor | undefined): boolean {
	return actor?.kind === 'user';
}

export function isAiActor(actor: Actor | undefined): boolean {
	return actor?.kind === 'ai';
}

export function isSystemActor(actor: Actor | undefined): boolean {
	return actor?.kind === 'system';
}

/** True when a write came from the server-side mission runner
 *  specifically (distinct from other system subsystems). */
export function isFromMissionRunner(actor: Actor | undefined): boolean {
	return actor?.kind === 'system' && actor.principalId === SYSTEM_MISSION_RUNNER;
}

// ─── Legacy export ───────────────────────────────────────────

/**
 * Placeholder user actor for tests and fallback sites. Uses a
 * `legacy:user` principalId — call sites with a real userId should use
 * `makeUserActor(userId, displayName)` instead.
 *
 * The webapp overrides this at login with the real user via an ambient-
 * context setter; see `data/events/actor.ts` in the web app for the
 * runtime-configurable default.
 */
export const USER_ACTOR: Actor = makeUserActor(LEGACY_USER_PRINCIPAL, 'Du');
