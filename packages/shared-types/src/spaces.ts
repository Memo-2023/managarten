/**
 * Space Types & Module Allowlist
 *
 * Framework-free definition of the Space primitive — the unit of data
 * ownership in Mana. Consumed by both the SvelteKit frontend and the
 * Bun/Hono services (mana-auth, mana-api, mana-sync), which is why this
 * lives in shared-types instead of shared-branding (the latter carries
 * Svelte components and is too heavy for a server).
 *
 * UI-facing labels/descriptions for these types live in shared-branding.
 *
 * See docs/plans/spaces-foundation.md for the full RFC.
 */

/**
 * The six canonical Space types. Every Better Auth organization must have
 * exactly one of these as `metadata.type`.
 *
 * - `personal` — single-member, auto-created on signup. Holds private data
 *   like mood, sleep, dreams that don't belong in a shared context.
 * - `brand`    — external communication identity (e.g. Edisconet, a creator
 *   persona). Hosts social-relay, mail, landing, public content.
 * - `club`     — association/Verein. Member management, dues, events,
 *   governance. Target for the ClubDesk-replacement roadmap.
 * - `family`   — household/family/WG. Shared calendar, shopping, recipes.
 * - `team`     — work team / project. Tasks, chat, docs.
 * - `practice` — freelancer/solo-business. Invoicing, clients, time tracking.
 */
export type SpaceType = 'personal' | 'brand' | 'club' | 'family' | 'team' | 'practice';

export const SPACE_TYPES: readonly SpaceType[] = [
	'personal',
	'brand',
	'club',
	'family',
	'team',
	'practice',
] as const;

export function isSpaceType(value: unknown): value is SpaceType {
	return typeof value === 'string' && (SPACE_TYPES as readonly string[]).includes(value);
}

/**
 * Module IDs referenced by the allowlist. Strings (not a strict enum) because
 * the allowlist intentionally includes modules that don't exist yet — e.g.
 * `club-finance`, `social-relay` — so features can be gated before the code
 * lands.
 */
export type SpaceModuleId = string;

/**
 * Which modules are available inside each Space type.
 *
 * The personal space gets everything (sentinel `'*'`). Other types get a
 * curated subset — modules dealing with intimate personal data (mood,
 * dreams, period, body measurements, …) are intentionally excluded from
 * shared spaces.
 *
 * Rule of thumb: if a module's data would feel wrong shared with co-workers
 * or club members, keep it out.
 */
export const SPACE_MODULE_ALLOWLIST: Record<SpaceType, readonly SpaceModuleId[] | '*'> = {
	personal: '*',

	brand: [
		'mana',
		'social-relay', // future — not yet built
		'mail',
		'contacts',
		'calendar',
		'storage',
		'landing', // future
		'website',
		'presi',
		'cards',
		'picture',
		'quotes',
		'news-research',
		'research-lab',
		'ai-agents',
		'companion',
		'times',
		'notes',
		'photos',
		'invoices',
		'activity',
		'goals',
		'comic', // Marken-Comics / Launch-Stories / Produkt-Storys
	],

	club: [
		'mana',
		'contacts',
		'calendar',
		'events',
		'mail',
		'storage',
		'research-lab',
		'club-members', // future — ClubDesk Paket A
		'club-finance', // future — ClubDesk Paket B
		'invoices',
		'finance',
		'landing', // future — Paket C (Vereinswebsite)
		'website',
		'presi',
		'cards',
		'quotes',
		'companion',
		'times',
		'notes',
		'photos',
		'activity',
		'goals',
		'comic', // Vereinsgeschichte, Event-Rückblicke als Comic
	],

	family: [
		'mana',
		'contacts',
		'calendar',
		'events',
		'mail',
		'storage',
		'website',
		'recipes',
		'places',
		'presi',
		'cards',
		'photos',
		'notes',
		'companion',
		'goals',
		'activity',
		'wetter',
		'wisekeep',
		'firsts',
		'comic', // Familien-Erinnerungen / Kinder-Abenteuer als Comic
	],

	team: [
		'mana',
		'contacts',
		'calendar',
		'events',
		'storage',
		'mail',
		'website',
		'news-research',
		'research-lab',
		'presi',
		'cards',
		'picture',
		'notes',
		'quotes',
		'invoices',
		'companion',
		'ai-agents',
		'times',
		'activity',
		'goals',
		'comic', // Team-Anekdoten, Retro-Storytelling, Release-Comics
	],

	practice: [
		'mana',
		'contacts',
		'calendar',
		'storage',
		'mail',
		'website',
		'invoices',
		'finance',
		'times',
		'notes',
		'presi',
		'cards',
		'quotes',
		'companion',
		'research-lab',
		'activity',
		'goals',
		'comic', // Patienten-Aufklärungs-Comics, Praxis-Storys
	],
} as const;

/**
 * Check whether a module is available inside a given Space type.
 *
 * Used by:
 *   - Scope wrapper (apps/mana/.../data/scope/scoped-db.ts) to block queries
 *     against disallowed modules — structural guard against UI bypass.
 *   - UI module launcher to hide disabled modules in the active space.
 *   - Route guards that check before mounting a module page.
 */
export function isModuleAllowedInSpace(moduleId: SpaceModuleId, spaceType: SpaceType): boolean {
	const allow = SPACE_MODULE_ALLOWLIST[spaceType];
	if (allow === '*') return true;
	return allow.includes(moduleId);
}

/**
 * Shape of the `metadata` JSONB column on Better Auth's `organization` table
 * for our Space extension. `type` is required; other fields accumulate as
 * features land (voiceDoc, legalEntity, uid, aiPersonaId, …).
 */
/**
 * The access tiers a Space can have. Gates module access via
 * `requiredTier` on each ManaApp.
 *
 * Ordered from least to most access. A higher tier implies access to
 * everything a lower tier can reach.
 */
export type SpaceTier = 'guest' | 'public' | 'beta' | 'alpha' | 'founder';

export const SPACE_TIERS: readonly SpaceTier[] = [
	'guest',
	'public',
	'beta',
	'alpha',
	'founder',
] as const;

const TIER_LEVEL: Record<SpaceTier, number> = {
	guest: 0,
	public: 1,
	beta: 2,
	alpha: 3,
	founder: 4,
};

export function isSpaceTier(value: unknown): value is SpaceTier {
	return typeof value === 'string' && (SPACE_TIERS as readonly string[]).includes(value);
}

/**
 * Check whether a Space's tier is high enough to meet a required tier.
 * Both undefined/invalid tiers are treated as 'guest' (least access).
 */
export function spaceTierMeets(actual: SpaceTier | undefined, required: SpaceTier): boolean {
	const a = actual && isSpaceTier(actual) ? TIER_LEVEL[actual] : 0;
	const r = TIER_LEVEL[required];
	return a >= r;
}

export interface SpaceMetadata {
	type: SpaceType;
	/**
	 * Access tier for this Space. Gates which modules / features the
	 * Space can use via ManaApp.requiredTier. Defaults to 'public'.
	 * The signup hook stamps the user's prior user-level tier onto the
	 * personal Space so no one loses access during the user→space tier
	 * migration.
	 */
	tier?: SpaceTier;
	voiceDoc?: string;
	legalEntity?: string;
	uid?: string;
	aiPersonaId?: string;
	[key: string]: unknown;
}

/**
 * Narrow a raw metadata blob (from Better Auth / DB) to a validated
 * SpaceMetadata. Returns null if no valid type field is present — callers
 * decide whether to reject or default.
 */
export function parseSpaceMetadata(raw: unknown): SpaceMetadata | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	if (!isSpaceType(obj.type)) return null;
	return obj as SpaceMetadata;
}
