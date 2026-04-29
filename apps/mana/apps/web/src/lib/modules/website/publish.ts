/**
 * Snapshot builder + publish client.
 *
 * `buildSnapshot(siteId)` walks Dexie to produce the deterministic blob
 * the publish endpoint stores. `publishSite()` and `unpublishSite()`
 * thin wrappers around the api + sync-path.
 *
 * Determinism: pages sorted by (order ASC, id ASC), block trees by the
 * same key. Same draft state → same blob bytes, regardless of which
 * client or session does the publish. Important because we might later
 * skip re-publish-if-no-change in the UI, and because a byte-identical
 * blob means CF cache keys stay stable.
 *
 * See docs/plans/website-builder.md §D5.
 */

import { getManaApiUrl } from '$lib/api/config';
import { websitesTable, websitePagesTable, websiteBlocksTable } from './collections';
import { resolveEmbed } from './embeds';
import { resolveFormEmbed } from './forms-embeds';
import type {
	LocalWebsite,
	LocalWebsiteBlock,
	ThemeConfig,
	NavConfig,
	FooterConfig,
	SiteSettings,
	PageSeo,
} from './types';
import type { FormEmbedProps, ModuleEmbedProps } from '@mana/website-blocks';

// ─── Snapshot shape ──────────────────────────────────────

export const SNAPSHOT_VERSION = '1' as const;

export interface SnapshotBlockNode {
	id: string;
	type: string;
	schemaVersion: number;
	slotKey: string | null;
	props: unknown;
	children: SnapshotBlockNode[];
}

export interface SnapshotPage {
	id: string;
	path: string;
	title: string;
	seo: PageSeo;
	blocks: SnapshotBlockNode[];
}

export interface SnapshotSite {
	id: string;
	slug: string;
	name: string;
	theme: ThemeConfig;
	navConfig: NavConfig;
	footerConfig: FooterConfig;
	settings: SiteSettings;
}

/**
 * Client-built snapshot. Server augments with `publishedAt` and
 * `publishedBy` before storage — those fields live on the row, not in
 * the client-sent payload, so they can't be spoofed.
 */
export interface DraftSnapshot {
	version: typeof SNAPSHOT_VERSION;
	site: SnapshotSite;
	pages: SnapshotPage[];
}

/**
 * The shape served by the public endpoint — client-built blob plus the
 * server-authored publication fields.
 */
export interface PublishedSnapshot extends DraftSnapshot {
	publishedAt: string;
	publishedBy: string;
	snapshotId: string;
}

// ─── Build (Dexie → DraftSnapshot) ───────────────────────

export class SnapshotBuildError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SnapshotBuildError';
	}
}

/**
 * Assemble the draft snapshot for `siteId` from Dexie. Throws if the
 * site, a required table, or any referenced record is missing.
 */
export async function buildSnapshot(siteId: string): Promise<DraftSnapshot> {
	const site = await websitesTable.get(siteId);
	if (!site || site.deletedAt) {
		throw new SnapshotBuildError(`Site ${siteId} not found`);
	}

	const allPages = await websitePagesTable.where('siteId').equals(siteId).toArray();
	const livePages = allPages
		.filter((p) => !p.deletedAt)
		.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
	if (livePages.length === 0) {
		throw new SnapshotBuildError(
			`Site ${siteId} has no pages — add at least one before publishing`
		);
	}

	const pageIds = livePages.map((p) => p.id);
	const allBlocks = await websiteBlocksTable.where('pageId').anyOf(pageIds).toArray();
	const liveBlocks = allBlocks.filter((b) => !b.deletedAt);

	// Group blocks by pageId for fast tree building.
	const blocksByPage = new Map<string, LocalWebsiteBlock[]>();
	for (const block of liveBlocks) {
		const existing = blocksByPage.get(block.pageId);
		if (existing) existing.push(block);
		else blocksByPage.set(block.pageId, [block]);
	}

	const pages: SnapshotPage[] = livePages.map((p) => ({
		id: p.id,
		path: p.path,
		title: p.title,
		seo: p.seo ?? {},
		blocks: buildBlockTree(blocksByPage.get(p.id) ?? []),
	}));

	// Pre-resolve moduleEmbed blocks: walk the tree, fetch source data
	// from Dexie, inline into block.props. The public renderer serves
	// the snapshot without further lookups. See plan §M4.
	for (const page of pages) {
		await resolveEmbedsInTree(page.blocks);
	}

	return {
		version: SNAPSHOT_VERSION,
		site: toSnapshotSite(site),
		pages,
	};
}

async function resolveEmbedsInTree(nodes: SnapshotBlockNode[]): Promise<void> {
	for (const node of nodes) {
		if (node.type === 'moduleEmbed') {
			const props = node.props as ModuleEmbedProps;
			const resolved = await resolveEmbed(props);
			node.props = { ...props, resolved };
		} else if (node.type === 'formEmbed') {
			const props = node.props as FormEmbedProps;
			const resolved = await resolveFormEmbed(props);
			node.props = { ...props, resolved };
		}
		if (node.children.length > 0) {
			await resolveEmbedsInTree(node.children);
		}
	}
}

function toSnapshotSite(site: LocalWebsite): SnapshotSite {
	return {
		id: site.id,
		slug: site.slug,
		name: site.name,
		theme: site.theme,
		navConfig: site.navConfig,
		footerConfig: site.footerConfig,
		settings: site.settings,
	};
}

/**
 * Build the block tree deterministically. Top-level blocks (parentBlockId
 * null) come first, ordered by (order ASC, id ASC); each child list uses
 * the same ordering. Unreachable blocks (parentBlockId points at a row
 * that isn't in `blocks`) are dropped — they'd be orphans that the
 * renderer couldn't show anyway.
 */
export function buildBlockTree(blocks: LocalWebsiteBlock[]): SnapshotBlockNode[] {
	const byId = new Map<string, LocalWebsiteBlock>();
	for (const b of blocks) byId.set(b.id, b);

	const childrenByParent = new Map<string | null, LocalWebsiteBlock[]>();
	for (const b of blocks) {
		const parent = b.parentBlockId ?? null;
		// Drop orphans: a non-null parentBlockId that doesn't resolve.
		if (parent !== null && !byId.has(parent)) continue;
		const list = childrenByParent.get(parent);
		if (list) list.push(b);
		else childrenByParent.set(parent, [b]);
	}
	// Stable sort every bucket.
	for (const list of childrenByParent.values()) {
		list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
	}

	function walk(parentId: string | null): SnapshotBlockNode[] {
		const children = childrenByParent.get(parentId) ?? [];
		return children.map((b) => ({
			id: b.id,
			type: b.type,
			schemaVersion: b.schemaVersion,
			slotKey: b.slotKey ?? null,
			props: b.props,
			children: walk(b.id),
		}));
	}

	return walk(null);
}

// ─── Publish client ──────────────────────────────────────

/**
 * Returned by the API on successful publish.
 */
export interface PublishResult {
	snapshotId: string;
	publishedAt: string;
	publicUrl: string;
}

export class PublishError extends Error {
	readonly code: string;
	readonly status: number;
	constructor(message: string, code: string, status: number) {
		super(message);
		this.name = 'PublishError';
		this.code = code;
		this.status = status;
	}
}

/**
 * Call the publish endpoint. Caller must pass a mana-auth JWT and the
 * active space id (mana-auth doesn't embed the active space in claims
 * yet — see §M6 of the plan).
 */
export async function publishSnapshot(
	siteId: string,
	jwt: string,
	spaceId: string | null
): Promise<PublishResult> {
	const draft = await buildSnapshot(siteId);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${jwt}`,
	};
	if (spaceId) headers['X-Mana-Space'] = spaceId;

	const res = await fetch(`${getManaApiUrl()}/api/v1/website/sites/${siteId}/publish`, {
		method: 'POST',
		headers,
		body: JSON.stringify(draft),
	});

	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
		throw new PublishError(
			body.error ?? `Publish failed (${res.status})`,
			body.code ?? 'UNKNOWN',
			res.status
		);
	}

	return (await res.json()) as PublishResult;
}

/**
 * Mark the site's public snapshot as no-longer-current — the public
 * renderer will serve 404 on the next request.
 */
export async function unpublishSnapshot(siteId: string, jwt: string): Promise<void> {
	const res = await fetch(`${getManaApiUrl()}/api/v1/website/sites/${siteId}/unpublish`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${jwt}` },
	});
	if (!res.ok && res.status !== 404) {
		throw new PublishError(`Unpublish failed (${res.status})`, 'UNKNOWN', res.status);
	}
}

/**
 * Fetch the site's snapshot history (for rollback UI).
 */
export interface SnapshotHistoryEntry {
	id: string;
	publishedAt: string;
	publishedBy: string;
	isCurrent: boolean;
	slug: string;
}

export async function fetchSnapshotHistory(
	siteId: string,
	jwt: string
): Promise<SnapshotHistoryEntry[]> {
	const res = await fetch(`${getManaApiUrl()}/api/v1/website/sites/${siteId}/snapshots`, {
		headers: { Authorization: `Bearer ${jwt}` },
	});
	if (!res.ok) {
		throw new PublishError(`History fetch failed (${res.status})`, 'UNKNOWN', res.status);
	}
	const body = (await res.json()) as { snapshots: SnapshotHistoryEntry[] };
	return body.snapshots;
}

export interface SubmissionEntry {
	id: string;
	blockId: string;
	payload: Record<string, unknown>;
	targetModule: string;
	status: string;
	errorMessage: string | null;
	createdAt: string;
}

export async function fetchSubmissions(siteId: string, jwt: string): Promise<SubmissionEntry[]> {
	const res = await fetch(`${getManaApiUrl()}/api/v1/website/sites/${siteId}/submissions`, {
		headers: { Authorization: `Bearer ${jwt}` },
	});
	if (!res.ok) {
		throw new PublishError(`Submissions fetch failed (${res.status})`, 'UNKNOWN', res.status);
	}
	const body = (await res.json()) as { submissions: SubmissionEntry[] };
	return body.submissions;
}

export async function deleteSubmission(
	siteId: string,
	submissionId: string,
	jwt: string
): Promise<void> {
	const res = await fetch(
		`${getManaApiUrl()}/api/v1/website/sites/${siteId}/submissions/${submissionId}`,
		{
			method: 'DELETE',
			headers: { Authorization: `Bearer ${jwt}` },
		}
	);
	if (!res.ok && res.status !== 404) {
		throw new PublishError(`Delete submission failed (${res.status})`, 'UNKNOWN', res.status);
	}
}

export async function rollbackSnapshot(
	siteId: string,
	snapshotId: string,
	jwt: string
): Promise<void> {
	const res = await fetch(
		`${getManaApiUrl()}/api/v1/website/sites/${siteId}/rollback/${snapshotId}`,
		{
			method: 'POST',
			headers: { Authorization: `Bearer ${jwt}` },
		}
	);
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
		throw new PublishError(
			body.error ?? `Rollback failed (${res.status})`,
			body.code ?? 'UNKNOWN',
			res.status
		);
	}
}
