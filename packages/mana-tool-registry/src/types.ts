/**
 * Core types for the shared tool registry.
 *
 * A ToolSpec is everything a consumer needs to: expose the tool
 * (name, description, schemas), gate the tool (scope, policyHint),
 * and run the tool (handler + ToolContext).
 *
 * Consumers today:
 *   - mana-mcp   — exposes tools over MCP to external agents
 *   - mana-ai    — invokes tools inside the mission-runner tick loop
 *
 * Both derive their JSON Schema from the zod definitions here; there
 * is no parallel source of truth.
 */

import type { z } from 'zod';

export type ModuleId =
	| 'habits'
	| 'spaces'
	// — M1.5+ additions below —
	| 'todo'
	| 'notes'
	| 'journal'
	| 'calendar'
	| 'contacts'
	| 'articles'
	| 'missions'
	| 'tags'
	| 'mood'
	// — M5 (me-images + reference-based image generation) —
	| 'me'
	// — Comic M5 (stories + panel generation from cross-module text) —
	| 'comic'
	// — Augur M5 (signs / fortunes / hunches + Living Oracle + year recap) —
	| 'augur';

/**
 * `user-space` — operates on the caller's data within a specific Space.
 *                Exposable via MCP.
 * `admin`      — mutates cross-user or system state (tier changes, user
 *                deletion). Never exposed via MCP; mana-ai consumes only
 *                if the mission is marked as admin-capable.
 */
export type ToolScope = 'user-space' | 'admin';

/**
 * `read`        — idempotent, no state change. Safe to auto-invoke.
 * `write`       — creates or updates user data. Requires explicit policy
 *                 allowance in the consumer.
 * `destructive` — deletes or archives irreversibly. MCP refuses to expose
 *                 these tools entirely; mana-ai requires explicit mission
 *                 policy `auto: true` for the specific tool.
 */
export type PolicyHint = 'read' | 'write' | 'destructive';

/**
 * Runtime context handed to every tool handler.
 *
 * Constructed by the consumer from the incoming request:
 *   - mana-mcp   decodes the JWT and pulls spaceId from `X-Mana-Space`
 *                (defaulting to the user's active personal space)
 *   - mana-ai    builds it from the mission's userId + spaceId
 */
export interface ToolContext {
	userId: string;
	spaceId: string;
	/** Forwarded to downstream service calls (mana-sync etc.). */
	jwt: string;
	logger: Logger;
	/** Identifies the invoker for audit trail rows (persona_actions etc.). */
	invoker: 'mcp' | 'mana-ai' | 'admin';
	/**
	 * Lazy master-key fetcher for tools that encrypt/decrypt user-visible
	 * fields. Throws `ZeroKnowledgeUserError` for ZK users (the server
	 * cannot open their vault) and `MasterKeyFetchError` on any other
	 * failure. Tools that only touch plaintext tables should never call
	 * this.
	 */
	getMasterKey(): Promise<CryptoKey>;
}

export interface Logger {
	debug(msg: string, meta?: Record<string, unknown>): void;
	info(msg: string, meta?: Record<string, unknown>): void;
	warn(msg: string, meta?: Record<string, unknown>): void;
	error(msg: string, meta?: Record<string, unknown>): void;
}

/**
 * Single tool definition. Generic in the zod schemas so handlers receive
 * the parsed (post-defaults) input type and return the validated output
 * type. Schema-first generics keep `.default()`, `.transform()`, and
 * `.refine()` working without manual Input/Output juggling.
 *
 * Registry storage uses `AnyToolSpec` (see registry.ts).
 */
export interface ToolSpec<
	InputSchema extends z.ZodTypeAny = z.ZodTypeAny,
	OutputSchema extends z.ZodTypeAny = z.ZodTypeAny,
> {
	/** Canonical dot-name, e.g. `habits.create`. Unique across registry. */
	readonly name: string;
	/** Human-facing description — used by MCP, LLM system prompts. */
	readonly description: string;
	readonly module: ModuleId;
	readonly scope: ToolScope;
	readonly policyHint: PolicyHint;
	readonly input: InputSchema;
	readonly output: OutputSchema;
	/**
	 * Declares which record fields the tool encrypts on write and decrypts
	 * on read. Set to the exact field list from
	 * `apps/mana/apps/web/src/lib/data/crypto/registry.ts` for the same
	 * table. Omit entirely for plaintext-only tools.
	 *
	 * Declarative rather than handler-internal so a consistency check can
	 * diff this against the web-app registry at build time (future CI
	 * audit).
	 */
	readonly encryptedFields?: {
		readonly table: string;
		readonly fields: readonly string[];
	};
	readonly handler: (
		input: z.output<InputSchema>,
		ctx: ToolContext
	) => Promise<z.output<OutputSchema>>;
}

export type AnyToolSpec = ToolSpec<z.ZodTypeAny, z.ZodTypeAny>;
