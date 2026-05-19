/**
 * Writing module tools — AI-accessible operations over drafts + styles.
 *
 * Auto (read-only):
 *   - list_drafts
 *   - get_draft
 *   - list_writing_styles
 *
 * Propose (human approval per the agent's policy):
 *   - create_draft
 *   - generate_draft_content
 *   - refine_draft_selection
 *   - set_draft_status
 *
 * All writes delegate to the existing stores so the encryption + events
 * pipeline runs once, no matter whether the call came from the UI,
 * the foreground mission runner, or an external MCP client.
 */

import type { ModuleTool } from '$lib/data/tools/types';
import { deriveUpdatedAt } from '$lib/data/sync';
import { draftsStore } from './stores/drafts.svelte';
import { generationsStore } from './stores/generations.svelte';
import { draftTable, draftVersionTable } from './collections';
import { decryptRecords, VaultLockedError } from '$lib/data/crypto';
import { toDraft, toDraftVersion } from './queries';
import { STYLE_PRESETS } from './presets/styles';
import { writingStyleTable } from './collections';
import { getCurrentActor, isAiActor } from '$lib/data/events';
import { getAgent } from '$lib/data/ai/agents/store';
import type {
	LocalDraft,
	LocalDraftVersion,
	LocalWritingStyle,
	DraftKind,
	DraftStatus,
} from './types';

/**
 * When an AI actor is running a writing tool without an explicit
 * styleId, fall back to the agent's `defaultWritingStyleId`. User-
 * invoked calls skip this — a human passing no styleId means "ad-hoc,
 * no style", not "use my default".
 */
async function resolveAgentDefaultStyle(): Promise<string | null> {
	const actor = getCurrentActor();
	if (!isAiActor(actor)) return null;
	try {
		const agent = await getAgent(actor.principalId);
		return agent?.defaultWritingStyleId ?? null;
	} catch {
		return null;
	}
}

const KINDS: DraftKind[] = [
	'blog',
	'essay',
	'email',
	'social',
	'story',
	'letter',
	'speech',
	'cover-letter',
	'product-description',
	'press-release',
	'bio',
	'other',
];
const STATUSES: DraftStatus[] = ['draft', 'refining', 'complete', 'published'];
const REFINE_OPS = ['shorten', 'expand', 'tone', 'rewrite', 'translate'] as const;
type RefineOp = (typeof REFINE_OPS)[number];
const REFINE_KIND_MAP: Record<
	RefineOp,
	| 'selection-shorten'
	| 'selection-expand'
	| 'selection-tone'
	| 'selection-rewrite'
	| 'selection-translate'
> = {
	shorten: 'selection-shorten',
	expand: 'selection-expand',
	tone: 'selection-tone',
	rewrite: 'selection-rewrite',
	translate: 'selection-translate',
};

export const writingTools: ModuleTool[] = [
	{
		name: 'list_drafts',
		module: 'writing',
		description:
			'Listet Writing-Drafts (id, kind, title, status, wordCount). Optional nach kind/status filterbar.',
		parameters: [
			{ name: 'kind', type: 'string', description: 'Nur eine Textart', required: false },
			{ name: 'status', type: 'string', description: 'Nur einen Status', required: false },
			{ name: 'limit', type: 'number', description: 'Max (Standard 30)', required: false },
		],
		async execute(params) {
			const kindFilter = params.kind as DraftKind | undefined;
			const statusFilter = params.status as DraftStatus | undefined;
			const limit = Math.min(Math.max(Number(params.limit) || 30, 1), 100);

			try {
				const drafts = await draftTable.toArray();
				const visible = drafts.filter((d) => !d.deletedAt);
				const decrypted = await decryptRecords('writingDrafts', visible);
				const byId = new Map<string, LocalDraft>();
				for (const d of decrypted) byId.set(d.id, d);

				// Pull current versions in one batch so the listing can report
				// word-counts without per-row queries.
				const versionIds = decrypted
					.map((d) => d.currentVersionId)
					.filter((id): id is string => !!id);
				const versionRows = (await draftVersionTable.bulkGet(versionIds)).filter(
					(v): v is LocalDraftVersion => !!v && !v.deletedAt
				);
				const versionsDecrypted = await decryptRecords('writingDraftVersions', versionRows);
				const versionById = new Map<string, LocalDraftVersion>();
				for (const v of versionsDecrypted) versionById.set(v.id, v);

				const rows = decrypted
					.map(toDraft)
					.filter((d) => (kindFilter ? d.kind === kindFilter : true))
					.filter((d) => (statusFilter ? d.status === statusFilter : true))
					.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
					.slice(0, limit)
					.map((d) => {
						const v = d.currentVersionId ? versionById.get(d.currentVersionId) : undefined;
						return {
							id: d.id,
							kind: d.kind,
							title: d.title,
							status: d.status,
							wordCount: v?.wordCount ?? 0,
							updatedAt: deriveUpdatedAt(d),
						};
					});

				return {
					success: true,
					data: { drafts: rows, total: rows.length },
					message: `${rows.length} Draft(s) gelistet`,
				};
			} catch (err) {
				if (err instanceof VaultLockedError) {
					return {
						success: false,
						message: 'Vault ist gesperrt — Writing kann nicht entschlüsselt werden',
					};
				}
				throw err;
			}
		},
	},

	{
		name: 'get_draft',
		module: 'writing',
		description:
			'Liefert einen vollstaendigen Draft inklusive Briefing, aktueller Version, Stil-ID und Quellen.',
		parameters: [{ name: 'draftId', type: 'string', description: 'ID des Drafts', required: true }],
		async execute(params) {
			const draftId = String(params.draftId ?? '');
			if (!draftId) return { success: false, message: 'draftId erforderlich' };

			try {
				const local = await draftTable.get(draftId);
				if (!local || local.deletedAt) {
					return { success: false, message: `Draft ${draftId} nicht gefunden` };
				}
				const [decrypted] = await decryptRecords('writingDrafts', [local]);
				if (!decrypted) return { success: false, message: 'Entschlüsselung fehlgeschlagen' };
				const draft = toDraft(decrypted);

				let version = null as ReturnType<typeof toDraftVersion> | null;
				if (draft.currentVersionId) {
					const vLocal = await draftVersionTable.get(draft.currentVersionId);
					if (vLocal && !vLocal.deletedAt) {
						const [vDec] = await decryptRecords('writingDraftVersions', [vLocal]);
						if (vDec) version = toDraftVersion(vDec);
					}
				}

				return {
					success: true,
					data: {
						draft: {
							id: draft.id,
							kind: draft.kind,
							status: draft.status,
							title: draft.title,
							briefing: draft.briefing,
							styleId: draft.styleId,
							references: draft.references,
							visibility: draft.visibility,
							publishedTo: draft.publishedTo,
							createdAt: draft.createdAt,
							updatedAt: deriveUpdatedAt(draft),
						},
						version: version
							? {
									id: version.id,
									versionNumber: version.versionNumber,
									content: version.content,
									wordCount: version.wordCount,
									isAiGenerated: version.isAiGenerated,
								}
							: null,
					},
					message: `Draft "${draft.title}" (${draft.kind})`,
				};
			} catch (err) {
				if (err instanceof VaultLockedError) {
					return { success: false, message: 'Vault ist gesperrt' };
				}
				throw err;
			}
		},
	},

	{
		name: 'list_writing_styles',
		module: 'writing',
		description:
			'Listet verfuegbare Schreibstile: 9 Presets (id=preset:<name>) + alle Custom-Styles (uuid).',
		parameters: [],
		async execute() {
			try {
				const presets = STYLE_PRESETS.map((p) => ({
					id: `preset:${p.id}`,
					name: p.name.de,
					description: p.description.de,
					source: 'preset' as const,
				}));

				const rows = await writingStyleTable.toArray();
				const visible = rows.filter((s) => !s.deletedAt);
				const decrypted = await decryptRecords('writingStyles', visible);
				const customs = (decrypted as LocalWritingStyle[]).map((s) => ({
					id: s.id,
					name: s.name,
					description: s.description,
					source: s.source,
				}));

				return {
					success: true,
					data: { presets, customs, total: presets.length + customs.length },
					message: `${presets.length} Vorlagen + ${customs.length} eigene Stile`,
				};
			} catch (err) {
				if (err instanceof VaultLockedError) {
					return { success: false, message: 'Vault ist gesperrt' };
				}
				throw err;
			}
		},
	},

	{
		name: 'create_draft',
		module: 'writing',
		description: 'Legt einen neuen Writing-Draft mit Briefing an (ohne Generation).',
		parameters: [
			{ name: 'kind', type: 'string', description: 'Textart', required: true },
			{ name: 'title', type: 'string', description: 'Titel', required: true },
			{ name: 'topic', type: 'string', description: 'Kern-Briefing', required: true },
			{ name: 'audience', type: 'string', description: 'Zielgruppe', required: false },
			{ name: 'tone', type: 'string', description: 'Ton', required: false },
			{ name: 'language', type: 'string', description: 'Sprachcode', required: false },
			{ name: 'targetWords', type: 'number', description: 'Ziel-Laenge', required: false },
			{ name: 'styleId', type: 'string', description: 'Stil-ID', required: false },
			{ name: 'extraInstructions', type: 'string', description: 'Extra-Hinweise', required: false },
		],
		async execute(params) {
			const kind = params.kind as DraftKind;
			if (!KINDS.includes(kind)) return { success: false, message: `Unbekannte Art: ${kind}` };
			const title = String(params.title ?? '').trim();
			const topic = String(params.topic ?? '').trim();
			if (!title) return { success: false, message: 'title erforderlich' };
			if (!topic) return { success: false, message: 'topic erforderlich' };

			const targetWordsRaw =
				typeof params.targetWords === 'number' ? Math.round(params.targetWords) : null;
			const explicitStyleId =
				typeof params.styleId === 'string' && params.styleId.length > 0 ? params.styleId : null;
			// Persona-Linkage: AI actors inherit the agent's default style
			// when they don't pass one; user-invoked calls do not — a human
			// omitting styleId means "ad-hoc, no style".
			const styleId = explicitStyleId ?? (await resolveAgentDefaultStyle());
			const { draft } = await draftsStore.createDraft({
				kind,
				title,
				styleId,
				briefing: {
					topic,
					audience: typeof params.audience === 'string' ? params.audience : null,
					tone: typeof params.tone === 'string' ? params.tone : null,
					language: typeof params.language === 'string' ? params.language : 'de',
					targetLength: targetWordsRaw
						? { type: 'words' as const, value: targetWordsRaw }
						: undefined,
					extraInstructions:
						typeof params.extraInstructions === 'string' ? params.extraInstructions : null,
				},
			});

			return {
				success: true,
				data: { draftId: draft.id, kind: draft.kind, title: draft.title },
				message: `Draft "${draft.title}" angelegt`,
			};
		},
	},

	{
		name: 'generate_draft_content',
		module: 'writing',
		description:
			'Erzeugt Text fuer einen existierenden Draft und schreibt eine neue Version. Flippt currentVersionId.',
		parameters: [{ name: 'draftId', type: 'string', description: 'ID des Drafts', required: true }],
		async execute(params) {
			const draftId = String(params.draftId ?? '');
			if (!draftId) return { success: false, message: 'draftId erforderlich' };
			try {
				const generationId = await generationsStore.startDraftGeneration(draftId);
				return {
					success: true,
					data: { draftId, generationId },
					message: 'Text generiert und als neue Version gespeichert',
				};
			} catch (err) {
				return {
					success: false,
					message: err instanceof Error ? err.message : String(err),
				};
			}
		},
	},

	{
		name: 'refine_draft_selection',
		module: 'writing',
		description:
			'Verfeinert einen markierten Ausschnitt in der aktuellen Version — shorten/expand/tone/rewrite/translate. In-place auf current version.',
		parameters: [
			{ name: 'draftId', type: 'string', description: 'ID des Drafts', required: true },
			{
				name: 'operation',
				type: 'string',
				description: 'shorten|expand|tone|rewrite|translate',
				required: true,
			},
			{ name: 'selectionStart', type: 'number', description: 'Start (0-basiert)', required: true },
			{ name: 'selectionEnd', type: 'number', description: 'Ende (exklusiv)', required: true },
			{ name: 'targetTone', type: 'string', description: 'fuer operation=tone', required: false },
			{
				name: 'instruction',
				type: 'string',
				description: 'fuer operation=rewrite',
				required: false,
			},
			{
				name: 'targetLanguage',
				type: 'string',
				description: 'fuer operation=translate',
				required: false,
			},
		],
		async execute(params) {
			const draftId = String(params.draftId ?? '');
			const op = params.operation as RefineOp;
			if (!REFINE_OPS.includes(op)) {
				return { success: false, message: `Unbekannte operation: ${op}` };
			}
			const start = Number(params.selectionStart);
			const end = Number(params.selectionEnd);
			if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
				return { success: false, message: 'Ungueltige Auswahl-Range' };
			}

			try {
				const draft = await draftTable.get(draftId);
				if (!draft || draft.deletedAt || !draft.currentVersionId) {
					return { success: false, message: `Draft ${draftId} oder aktuelle Version fehlt` };
				}
				const versionLocal = await draftVersionTable.get(draft.currentVersionId);
				if (!versionLocal || versionLocal.deletedAt) {
					return { success: false, message: 'Aktuelle Version fehlt' };
				}
				const [versionDec] = await decryptRecords('writingDraftVersions', [versionLocal]);
				if (!versionDec) return { success: false, message: 'Entschlüsselung fehlgeschlagen' };
				const content = versionDec.content ?? '';
				const clampedEnd = Math.min(end, content.length);
				if (start < 0 || start >= content.length) {
					return { success: false, message: 'selectionStart ausserhalb des Textes' };
				}
				const text = content.slice(start, clampedEnd);
				if (!text.trim()) return { success: false, message: 'Auswahl ist leer' };

				const paramsForStore:
					| { targetTone: string }
					| { instruction: string }
					| { targetLanguage: string }
					| undefined =
					op === 'tone'
						? { targetTone: String(params.targetTone ?? '').trim() || 'neutral' }
						: op === 'rewrite'
							? { instruction: String(params.instruction ?? '').trim() }
							: op === 'translate'
								? { targetLanguage: String(params.targetLanguage ?? '').trim() || 'en' }
								: undefined;

				if (op === 'rewrite' && !(paramsForStore as { instruction: string }).instruction) {
					return { success: false, message: 'instruction erforderlich fuer rewrite' };
				}

				const { generationId, refined } = await generationsStore.refineSelection(
					draftId,
					draft.currentVersionId,
					{ start, end: clampedEnd, text },
					REFINE_KIND_MAP[op],
					paramsForStore as never
				);
				await generationsStore.applyRefinement(
					draft.currentVersionId,
					{ start, end: clampedEnd },
					refined,
					generationId
				);
				return {
					success: true,
					data: { draftId, generationId, refined },
					message: `Auswahl via ${op} verfeinert`,
				};
			} catch (err) {
				return { success: false, message: err instanceof Error ? err.message : String(err) };
			}
		},
	},

	{
		name: 'set_draft_status',
		module: 'writing',
		description: 'Setzt den Status eines Drafts (draft/refining/complete/published).',
		parameters: [
			{ name: 'draftId', type: 'string', description: 'ID', required: true },
			{ name: 'status', type: 'string', description: 'Neuer Status', required: true },
		],
		async execute(params) {
			const draftId = String(params.draftId ?? '');
			const status = params.status as DraftStatus;
			if (!STATUSES.includes(status)) {
				return { success: false, message: `Unbekannter Status: ${status}` };
			}
			await draftsStore.setStatus(draftId, status);
			return {
				success: true,
				data: { draftId, status },
				message: `Status auf "${status}" gesetzt`,
			};
		},
	},
];
