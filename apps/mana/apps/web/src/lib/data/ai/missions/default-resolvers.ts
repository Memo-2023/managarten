/**
 * Default input resolvers.
 *
 * Registered from `setup.ts` so the production MissionRunner can load
 * notes / goals / profile / todo / calendar without every module having
 * to know about the AI subsystem. Modules that need special projection
 * logic register their own resolver on init and override these defaults.
 *
 * Space-Kontext: since the kontextDoc table was retired in favour of a
 * `notes.isSpaceContext` flag, the "this is the standing context for
 * this Space" candidate is just a regular Note marked with the flag.
 * The notesResolver handles it like any other note; the notesIndexer
 * surfaces it with a star prefix so the picker bubbles it to the top.
 */

import { db } from '../../database';
import { decryptRecords } from '../../crypto';
import { registerInputResolver } from './input-resolvers';
import { registerInputIndexer } from './input-index';
import type { InputResolver } from './input-resolvers';
import type { InputCandidate, InputIndexer } from './input-index';

interface NoteLike {
	id: string;
	title?: string;
	content?: string;
	deletedAt?: string;
	isSpaceContext?: boolean;
}

const notesResolver: InputResolver = async (ref) => {
	const local = await db.table<NoteLike>(ref.table).get(ref.id);
	if (!local || local.deletedAt) return null;
	const [decrypted] = await decryptRecords(ref.table, [local]);
	return {
		id: ref.id,
		module: ref.module,
		table: ref.table,
		title: decrypted.title,
		content: decrypted.content ?? '',
	};
};

// ── User Context (structured profile + freeform) ──────────

interface UserContextLike {
	id: string;
	about?: { bio?: string; occupation?: string; location?: string; languages?: string[] };
	interests?: string[];
	routine?: { wakeUp?: string; workStart?: string; workEnd?: string; bedtime?: string };
	nutrition?: { diet?: string; allergies?: string[]; preferences?: string };
	leisure?: { media?: string[]; sports?: string[]; pets?: string };
	goals?: string[];
	social?: { communication?: string; workStyle?: string; livingSetup?: string };
	freeform?: string;
}

const userContextResolver: InputResolver = async (ref) => {
	const doc = await db.table<UserContextLike>('userContext').get(ref.id);
	if (!doc) return null;
	const [decrypted] = await decryptRecords('userContext', [doc]);
	return {
		id: ref.id,
		module: 'profile',
		table: 'userContext',
		title: 'Nutzerprofil',
		content: buildUserContextText(decrypted),
	};
};

function buildUserContextText(ctx: UserContextLike): string {
	const lines: string[] = [];
	if (ctx.about?.occupation) lines.push(`Beruf: ${ctx.about.occupation}`);
	if (ctx.about?.location) lines.push(`Ort: ${ctx.about.location}`);
	if (ctx.about?.languages?.length) lines.push(`Sprachen: ${ctx.about.languages.join(', ')}`);
	if (ctx.about?.bio) lines.push(`\nBio: ${ctx.about.bio}`);
	if (ctx.interests?.length) lines.push(`\nInteressen: ${ctx.interests.join(', ')}`);
	if (ctx.routine) {
		const r = ctx.routine;
		const parts = [];
		if (r.wakeUp) parts.push(`Aufstehen ${r.wakeUp}`);
		if (r.workStart && r.workEnd) parts.push(`Arbeit ${r.workStart}–${r.workEnd}`);
		if (r.bedtime) parts.push(`Schlafenszeit ${r.bedtime}`);
		if (parts.length) lines.push(`\nTagesroutine: ${parts.join(', ')}`);
	}
	if (ctx.nutrition) {
		if (ctx.nutrition.diet) lines.push(`Ernährung: ${ctx.nutrition.diet}`);
		if (ctx.nutrition.allergies?.length)
			lines.push(`Allergien: ${ctx.nutrition.allergies.join(', ')}`);
	}
	if (ctx.leisure) {
		if (ctx.leisure.media?.length) lines.push(`Medien: ${ctx.leisure.media.join(', ')}`);
		if (ctx.leisure.sports?.length) lines.push(`Sport: ${ctx.leisure.sports.join(', ')}`);
		if (ctx.leisure.pets) lines.push(`Haustiere: ${ctx.leisure.pets}`);
	}
	if (ctx.goals?.length) lines.push(`\nZiele: ${ctx.goals.join(', ')}`);
	if (ctx.social?.workStyle) lines.push(`Arbeitsweise: ${ctx.social.workStyle}`);
	if (ctx.social?.livingSetup) lines.push(`Wohnsituation: ${ctx.social.livingSetup}`);
	if (ctx.freeform?.trim()) lines.push(`\n---\n${ctx.freeform.trim()}`);
	return lines.join('\n');
}

const userContextIndexer: InputIndexer = async () => {
	const doc = await db.table<UserContextLike>('userContext').get('singleton');
	if (!doc) return [];
	return [
		{
			module: 'profile',
			table: 'userContext',
			id: 'singleton',
			label: 'Nutzerprofil',
			hint: 'Strukturiertes Profil + Freitext-Kontext',
		},
	];
};

interface GoalLike {
	id: string;
	title?: string;
	currentValue?: number;
	target?: { value: number };
	period?: string;
	deletedAt?: string;
}

const goalsResolver: InputResolver = async (ref) => {
	const goal = await db.table<GoalLike>(ref.table).get(ref.id);
	if (!goal || goal.deletedAt) return null;
	const current = goal.currentValue ?? 0;
	const target = goal.target?.value ?? '?';
	return {
		id: ref.id,
		module: ref.module,
		table: ref.table,
		title: goal.title ?? 'Goal',
		content: `Fortschritt: ${current} / ${target} (${goal.period ?? 'unbekannt'})`,
	};
};

// ── Indexers: list candidates for the picker UI ────────────

const notesIndexer: InputIndexer = async () => {
	const all = await db.table<NoteLike>('notes').toArray();
	const visible = all.filter((n) => !n.deletedAt);
	const decrypted = await decryptRecords('notes', visible);
	const candidates = decrypted.map<InputCandidate>((n) => ({
		module: 'notes',
		table: 'notes',
		id: n.id,
		label: (n.isSpaceContext ? '★ ' : '') + ((n.title && n.title.trim()) || '(ohne Titel)'),
		hint: n.isSpaceContext
			? 'Space-Kontext (auto-injected)'
			: n.content
				? `${n.content.slice(0, 60).replace(/\s+/g, ' ')}…`
				: undefined,
	}));
	// Sort: space-context-flagged notes first, then alphabetical.
	candidates.sort((a, b) => {
		const aFirst = a.label.startsWith('★ ');
		const bFirst = b.label.startsWith('★ ');
		if (aFirst !== bFirst) return aFirst ? -1 : 1;
		return a.label.localeCompare(b.label);
	});
	return candidates.slice(0, 200); // cap — Mission picker isn't meant to list thousands
};

const goalsIndexer: InputIndexer = async () => {
	const all = await db.table<GoalLike>('companionGoals').toArray();
	const visible = all.filter((g) => !g.deletedAt);
	return visible.map<InputCandidate>((g) => ({
		module: 'goals',
		table: 'companionGoals',
		id: g.id,
		label: g.title ?? 'Goal',
		hint: `${g.currentValue ?? 0} / ${g.target?.value ?? '?'} (${g.period ?? '—'})`,
	}));
};

// ── tasks (todo module, encrypted) ─────────────────────────

interface TaskLike {
	id: string;
	title?: string;
	description?: string;
	dueDate?: string;
	isCompleted?: boolean;
	deletedAt?: string;
}

const tasksResolver: InputResolver = async (ref) => {
	const local = await db.table<TaskLike>(ref.table).get(ref.id);
	if (!local || local.deletedAt) return null;
	const [decrypted] = await decryptRecords(ref.table, [local]);
	const status = decrypted.isCompleted ? 'erledigt' : 'offen';
	const due = decrypted.dueDate ? ` · fällig ${decrypted.dueDate}` : '';
	const body = decrypted.description ? `\n${decrypted.description}` : '';
	return {
		id: ref.id,
		module: ref.module,
		table: ref.table,
		title: decrypted.title,
		content: `[${status}]${due}${body}`,
	};
};

const tasksIndexer: InputIndexer = async () => {
	const all = await db.table<TaskLike>('tasks').toArray();
	const visible = all.filter((t) => !t.deletedAt && !t.isCompleted);
	const decrypted = await decryptRecords('tasks', visible);
	return decrypted
		.map<InputCandidate>((t) => ({
			module: 'todo',
			table: 'tasks',
			id: t.id,
			label: (t.title && t.title.trim()) || '(ohne Titel)',
			hint: t.dueDate ? `fällig ${t.dueDate}` : undefined,
		}))
		.slice(0, 200);
};

// ── calendar events (encrypted) ────────────────────────────

interface CalEventLike {
	id: string;
	title?: string;
	description?: string;
	location?: string;
	startIso?: string;
	endIso?: string;
	deletedAt?: string;
}

const calendarResolver: InputResolver = async (ref) => {
	const local = await db.table<CalEventLike>(ref.table).get(ref.id);
	if (!local || local.deletedAt) return null;
	const [decrypted] = await decryptRecords(ref.table, [local]);
	const when = decrypted.startIso
		? decrypted.endIso
			? `${decrypted.startIso} – ${decrypted.endIso}`
			: decrypted.startIso
		: '';
	const where = decrypted.location ? ` @ ${decrypted.location}` : '';
	const body = decrypted.description ? `\n${decrypted.description}` : '';
	return {
		id: ref.id,
		module: ref.module,
		table: ref.table,
		title: decrypted.title,
		content: `${when}${where}${body}`,
	};
};

const calendarIndexer: InputIndexer = async () => {
	const all = await db.table<CalEventLike>('events').toArray();
	// Show upcoming events (next 30 days) first; cap at 200 total.
	const now = Date.now();
	const horizon = now + 30 * 24 * 60 * 60_000;
	const upcoming = all
		.filter((e) => !e.deletedAt)
		.filter((e) => !e.startIso || new Date(e.startIso).getTime() >= now - 24 * 60 * 60_000)
		.sort((a, b) => (a.startIso ?? '').localeCompare(b.startIso ?? ''));
	const decrypted = await decryptRecords('events', upcoming);
	return decrypted
		.map<InputCandidate>((e) => ({
			module: 'calendar',
			table: 'events',
			id: e.id,
			label: (e.title && e.title.trim()) || '(ohne Titel)',
			hint: e.startIso
				? new Date(e.startIso).getTime() < horizon
					? `bald: ${e.startIso.slice(0, 16)}`
					: e.startIso.slice(0, 10)
				: undefined,
		}))
		.slice(0, 200);
};

let registered = false;

/** Register the default resolvers + indexers once. Idempotent. */
export function registerDefaultInputResolvers(): void {
	if (registered) return;
	registerInputResolver('notes', notesResolver);
	registerInputResolver('profile', userContextResolver);
	registerInputResolver('goals', goalsResolver);
	registerInputResolver('todo', tasksResolver);
	registerInputResolver('calendar', calendarResolver);
	registerInputIndexer('notes', notesIndexer);
	registerInputIndexer('profile', userContextIndexer);
	registerInputIndexer('goals', goalsIndexer);
	registerInputIndexer('todo', tasksIndexer);
	registerInputIndexer('calendar', calendarIndexer);
	registered = true;
}
