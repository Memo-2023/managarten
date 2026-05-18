import { formatDateTime } from '$lib/i18n/format';
/**
 * Module-embed resolvers — client-side functions that walk Dexie to
 * pre-fetch data for `moduleEmbed` blocks at publish time.
 *
 * These run exactly once per publish and inline the result into the
 * snapshot's `block.props.resolved` field, so the public renderer
 * reads the blob and never needs Dexie or the network to show embedded
 * content. Trade-off: publishes are slightly slower, public visits are
 * much faster.
 *
 * Every resolver MUST enforce the source's public-visibility rules
 * via `canEmbedOnWebsite(visibility)`. An owner who embeds a
 * non-public record gets an empty result with a clear error message
 * in the resolved.error field.
 */

import { db } from '$lib/data/database';
import { decryptRecords } from '$lib/data/crypto';
import { canEmbedOnWebsite } from '@mana/shared-privacy';
import { timeBlockTable } from '$lib/data/time-blocks/collections';
import { mediaFileUrl } from './upload';
import type { EmbedItem, EmbedSource, ModuleEmbedProps } from '@mana/website-blocks';
import type { LocalBoard, LocalBoardItem, LocalImage } from '$lib/modules/picture/types';
import type { LocalLibraryEntry } from '$lib/modules/library/types';
import type { LocalEvent } from '$lib/modules/calendar/types';
import type { LocalTask } from '$lib/modules/todo/types';
import type { LocalTaskTag } from '$lib/modules/todo/types';
import type { LocalGoal } from '$lib/companion/goals/types';
import type { LocalPlace } from '$lib/modules/places/types';
import type { LocalRecipe } from '$lib/modules/recipes/types';
import type { LocalHabit, LocalHabitLog } from '$lib/modules/habits/types';
import type { LocalQuiz } from '$lib/modules/quiz/types';
import type { LocalSocialEvent } from '$lib/modules/events/types';
import type { LocalDeck as LocalPresiDeck } from '$lib/modules/presi/types';
import type { LocalAugurEntry } from '$lib/modules/augur/types';
import type { LocalTimeBlock } from '$lib/data/time-blocks/types';

export interface ResolvedEmbed {
	items: EmbedItem[];
	error?: string;
	resolvedAt: string;
}

/** Resolve a single moduleEmbed block's props. */
export async function resolveEmbed(props: ModuleEmbedProps): Promise<ResolvedEmbed> {
	const now = new Date().toISOString();
	try {
		let items: EmbedItem[];
		switch (props.source as EmbedSource) {
			case 'picture.board':
				items = await resolvePictureBoard(props);
				break;
			case 'library.entries':
				items = await resolveLibraryEntries(props);
				break;
			case 'calendar.events':
				items = await resolveCalendarEvents(props);
				break;
			case 'todo.tasks':
				items = await resolveTodoTasks(props);
				break;
			case 'goals.goals':
				items = await resolveGoals(props);
				break;
			case 'places.places':
				items = await resolvePlaces(props);
				break;
			case 'recipes.recipes':
				items = await resolveRecipes(props);
				break;
			case 'habits.habits':
				items = await resolveHabits(props);
				break;
			case 'quiz.quizzes':
				items = await resolveQuizzes(props);
				break;
			case 'events.socialEvents':
				items = await resolveSocialEvents(props);
				break;
			// 'cards.decks' source: dekommissioniert 2026-05-08 (Cards
			// eigenständig auf cardecky.mana.how, kein Local-Dexie-Embed
			// mehr). Falls Public-Cardecky-Decks später website-embeddable
			// werden, käme das über die Cardecky-API und einen neuen
			// `cardecky.decks`-Source-Typ.
			case 'presi.decks':
				items = await resolvePresiDecks(props);
				break;
			case 'augur.entries':
				items = await resolveAugurEntries(props);
				break;
			default:
				return {
					items: [],
					error: `Unbekannte Quelle: ${props.source}`,
					resolvedAt: now,
				};
		}
		return { items: items.slice(0, props.maxItems), resolvedAt: now };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { items: [], error: message, resolvedAt: now };
	}
}

/**
 * Picture-board: returns image items for a board whose owner flipped
 * its visibility to 'public' via the VisibilityPicker. `canEmbedOnWebsite`
 * is the hard gate.
 */
async function resolvePictureBoard(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	if (!props.sourceId) {
		throw new Error('Bitte wähle ein Board aus');
	}

	const [rawBoard] = await db
		.table<LocalBoard>('boards')
		.where('id')
		.equals(props.sourceId)
		.toArray();

	if (!rawBoard || rawBoard.deletedAt) {
		throw new Error('Board nicht gefunden');
	}
	const boardVisibility = rawBoard.visibility ?? 'private';
	if (!canEmbedOnWebsite(boardVisibility)) {
		throw new Error('Board ist nicht öffentlich — setze es im Picture-Modul auf "Öffentlich"');
	}

	const items = await db
		.table<LocalBoardItem>('boardItems')
		.where('boardId')
		.equals(props.sourceId)
		.toArray();

	const imageItems = items
		.filter((i) => !i.deletedAt && i.itemType === 'image' && i.imageId)
		.sort((a, b) => a.zIndex - b.zIndex);

	if (imageItems.length === 0) return [];

	const imageIds = imageItems.map((i) => i.imageId as string);
	const images = await db.table<LocalImage>('images').where('id').anyOf(imageIds).toArray();
	const decrypted = (await decryptRecords('images', images)) as LocalImage[];
	const imageById = new Map<string, LocalImage>();
	for (const img of decrypted) imageById.set(img.id, img);

	const out: EmbedItem[] = [];
	for (const item of imageItems) {
		const img = imageById.get(item.imageId as string);
		if (!img) continue;
		const url = img.publicUrl ?? mediaFileUrl(img.id, 'medium');
		out.push({
			title: img.prompt?.slice(0, 120) || 'Bild',
			imageUrl: url,
		});
	}
	return out;
}

/**
 * Library-entries: returns book/movie/series/comic entries the owner has
 * explicitly marked 'public' via the VisibilityPicker on the entry's
 * detail view. `canEmbedOnWebsite` is the hard gate — user-provided
 * filters (kind/status/favorite) stack on top but cannot override it.
 *
 * First pilot of the unified visibility system (docs/plans/
 * visibility-system.md). Before M2 this path used `isFavorite` as a
 * weak proxy for public intent; that filter is still available as an
 * optional user-facing filter on top of the visibility gate.
 */
async function resolveLibraryEntries(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let locals = await db.table<LocalLibraryEntry>('libraryEntries').toArray();
	locals = locals.filter((e) => !e.deletedAt && canEmbedOnWebsite(e.visibility ?? 'private'));

	if (props.filter?.kind) {
		locals = locals.filter((e) => e.kind === props.filter?.kind);
	}
	if (props.filter?.status) {
		locals = locals.filter((e) => e.status === props.filter?.status);
	}
	if (props.filter?.isFavorite === true) {
		locals = locals.filter((e) => e.isFavorite === true);
	}

	// Newest completions first.
	locals.sort((a, b) => {
		const aKey = a.completedAt ?? a.updatedAt ?? '';
		const bKey = b.completedAt ?? b.updatedAt ?? '';
		return bKey.localeCompare(aKey);
	});

	const decrypted = (await decryptRecords('libraryEntries', locals)) as LocalLibraryEntry[];

	return decrypted.map((entry) => {
		const creators = (entry.creators ?? []).slice(0, 2).join(', ');
		const year = entry.year ? ` · ${entry.year}` : '';
		const subtitle = creators ? `${creators}${year}` : year.trim() || undefined;
		return {
			title: entry.title,
			subtitle,
			imageUrl:
				entry.coverUrl ??
				(entry.coverMediaId ? mediaFileUrl(entry.coverMediaId, 'medium') : undefined),
		};
	});
}

/**
 * Calendar-events: returns events whose owner flipped visibility to
 * 'public'. By design (plan §2), the snapshot carries a whitelist of
 * fields only — title, start/end time, location. Description, guest
 * list, reminders, and tags are NOT inlined because they frequently
 * carry private context that an event's visibility toggle shouldn't
 * accidentally expose.
 *
 * Optional filters on top of the hard gate:
 *   - upcomingDays: number of days forward from now; events starting
 *     later are dropped. Omit to include all (past + future).
 *   - tagIds: at-least-one overlap with event.tagIds.
 */
async function resolveCalendarEvents(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let events = await db.table<LocalEvent>('events').toArray();
	events = events.filter((e) => !e.deletedAt && canEmbedOnWebsite(e.visibility ?? 'private'));

	if (props.filter?.tagIds?.length) {
		const wanted = new Set(props.filter.tagIds);
		events = events.filter((e) => (e.tagIds ?? []).some((t) => wanted.has(t)));
	}

	const decrypted = (await decryptRecords('events', events)) as LocalEvent[];

	// Join with TimeBlock for the actual start/end times (events only
	// store a reference). Fetch in one pass, then attach by id.
	const blockIds = decrypted.map((e) => e.timeBlockId).filter((id): id is string => Boolean(id));
	const blocks = await timeBlockTable.where('id').anyOf(blockIds).toArray();
	const byBlockId = new Map<string, LocalTimeBlock>();
	for (const b of blocks) byBlockId.set(b.id, b);

	const now = Date.now();
	const upcomingCutoff =
		typeof props.filter?.upcomingDays === 'number'
			? now + props.filter.upcomingDays * 24 * 60 * 60 * 1000
			: null;

	const withBlock: Array<{ event: LocalEvent; block: LocalTimeBlock; startMs: number }> = [];
	for (const e of decrypted) {
		const b = byBlockId.get(e.timeBlockId);
		if (!b) continue;
		const startMs = Date.parse(b.startDate);
		if (Number.isNaN(startMs)) continue;
		if (upcomingCutoff !== null && (startMs < now || startMs > upcomingCutoff)) continue;
		withBlock.push({ event: e, block: b, startMs });
	}

	// Upcoming-first; same-day ties broken by id so the snapshot is stable.
	withBlock.sort((a, b) => a.startMs - b.startMs || a.event.id.localeCompare(b.event.id));

	return withBlock.map(({ event, block }) => ({
		title: event.title,
		subtitle: formatEventSubtitle(block.startDate, block.endDate, block.allDay, event.location),
	}));
}

/**
 * Build the subtitle shown under a calendar-event embed card. Kept in
 * the plaintext layer (not in the Svelte renderer) so the inlined blob
 * is self-contained and the public page needs no locale-aware
 * formatting round-trip. German only for now — matches the rest of the
 * module copy.
 */
function formatEventSubtitle(
	startIso: string,
	endIso: string | null,
	allDay: boolean,
	location: string | null | undefined
): string {
	const start = new Date(startIso);
	const dateParts = formatDateTime(start, {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	});

	let timePart = '';
	if (!allDay) {
		const timeFormat = new Intl.DateTimeFormat('de-DE', {
			hour: '2-digit',
			minute: '2-digit',
		});
		const startTime = timeFormat.format(start);
		if (endIso) {
			const endTime = timeFormat.format(new Date(endIso));
			timePart = ` · ${startTime}–${endTime}`;
		} else {
			timePart = ` · ${startTime}`;
		}
	}

	const loc = location?.trim();
	const locPart = loc ? ` · ${loc}` : '';
	return `${dateParts}${timePart}${locPart}`;
}

/**
 * Todo-tasks: public-roadmap use case. Returns tasks flipped to
 * 'public' via the VisibilityPicker on the Todo DetailView. Filters
 * (status, tagIds) are optional and stack on top of the hard gate.
 *
 * Whitelist (plan §2): only title and a compact status label land in
 * the snapshot. Description, subtasks, LLM-labels, dueDate, and
 * project-membership stay out — they frequently carry private context
 * the user didn't intend to publish by flipping a single flag.
 *
 * `tagIds` filter: tasks are tagged through the N:N `taskTags` table;
 * the resolver joins tag assignments inline rather than asking each
 * task to carry a denormalised tagIds array.
 */
async function resolveTodoTasks(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let tasks = await db.table<LocalTask>('tasks').toArray();
	tasks = tasks.filter((t) => !t.deletedAt && canEmbedOnWebsite(t.visibility ?? 'private'));

	if (props.filter?.status) {
		const wantCompleted = props.filter.status === 'completed';
		tasks = tasks.filter((t) => t.isCompleted === wantCompleted);
	}

	if (props.filter?.tagIds?.length) {
		const wanted = new Set(props.filter.tagIds);
		const taskTags = await db.table<LocalTaskTag>('taskTags').toArray();
		const hitTaskIds = new Set(
			taskTags.filter((tt) => wanted.has(tt.tagId)).map((tt) => tt.taskId)
		);
		tasks = tasks.filter((t) => hitTaskIds.has(t.id));
	}

	const decrypted = (await decryptRecords('tasks', tasks)) as LocalTask[];

	// Newest public-items first (by updatedAt); id as stable tiebreaker.
	decrypted.sort(
		(a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id)
	);

	return decrypted.map((t) => ({
		title: t.title,
		subtitle: t.isCompleted ? 'Erledigt' : 'In Arbeit',
	}));
}

/**
 * Goals: the "public progress page" use case — marked-public goals with
 * their current-period progress inlined so a visitor can see "4/5
 * Workouts diese Woche" at a glance. Gates hard on canEmbedOnWebsite.
 *
 * The inlined snapshot carries only title + formatted progress
 * ("currentValue / target period"). Description is dropped — users
 * often keep it as an internal "why this matters" note. Metric
 * configuration (which event type, filter fields) also stays private —
 * it leaks implementation detail of what the user tracks.
 */
async function resolveGoals(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let goals = await db.table<LocalGoal>('companionGoals').toArray();
	goals = goals.filter((g) => !g.deletedAt && canEmbedOnWebsite(g.visibility ?? 'private'));

	if (props.filter?.status) {
		goals = goals.filter((g) => g.status === props.filter?.status);
	}

	// Active goals first, then by target value descending so the
	// chunkier milestones land at the top.
	goals.sort((a, b) => {
		if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
		return b.target.value - a.target.value || a.id.localeCompare(b.id);
	});

	return goals.map((g) => ({
		title: g.title,
		subtitle: formatGoalProgress(g),
	}));
}

function formatGoalProgress(g: LocalGoal): string {
	const periodLabel =
		g.target.period === 'day' ? 'Tag' : g.target.period === 'week' ? 'Woche' : 'Monat';
	return `${g.currentValue} / ${g.target.value} · ${periodLabel}`;
}

/**
 * Places: "my favourite cafes" / "rehearsal rooms" / "gyms I train at".
 * Hard-gated on canEmbedOnWebsite.
 *
 * Whitelist (plan §2): title (place name) + subtitle (address only).
 * Latitude/longitude are NOT inlined — 10m precision of a home or
 * workplace can identify someone, and publishing coords by default on
 * a visibility flip would be the classic leak the design explicitly
 * guards against.
 */
async function resolvePlaces(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let places = await db.table<LocalPlace>('places').toArray();
	places = places.filter(
		(p) => !p.deletedAt && !p.isArchived && canEmbedOnWebsite(p.visibility ?? 'private')
	);

	if (props.filter?.kind) {
		places = places.filter((p) => p.category === props.filter?.kind);
	}
	if (props.filter?.isFavorite === true) {
		places = places.filter((p) => p.isFavorite === true);
	}
	if (props.filter?.tagIds?.length) {
		const wanted = new Set(props.filter.tagIds);
		places = places.filter((p) => (p.tagIds ?? []).some((t) => wanted.has(t)));
	}

	const decrypted = (await decryptRecords('places', places)) as LocalPlace[];

	// Favourites first, then alphabetical for a stable order.
	decrypted.sort((a, b) => {
		const favA = a.isFavorite ? 0 : 1;
		const favB = b.isFavorite ? 0 : 1;
		if (favA !== favB) return favA - favB;
		return a.name.localeCompare(b.name);
	});

	return decrypted.map((p) => ({
		title: p.name,
		subtitle: p.address ?? undefined,
	}));
}

/**
 * Recipes: "my tested recipes" / "cookbook". Hard-gated on
 * canEmbedOnWebsite.
 *
 * Whitelist (plan §2): title + description + photo URL + compact
 * time/difficulty line. Ingredient list, cooking steps, and internal
 * tags stay out of the snapshot — the public embed is a teaser, not
 * the full recipe. A future extension could surface the full recipe
 * on a dedicated /s/<slug>/recipes/<id> page behind an unlisted token,
 * but that's M8 scope.
 */
async function resolveRecipes(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let recipes = await db.table<LocalRecipe>('recipes').toArray();
	recipes = recipes.filter((r) => !r.deletedAt && canEmbedOnWebsite(r.visibility ?? 'private'));

	if (props.filter?.isFavorite === true) {
		recipes = recipes.filter((r) => r.isFavorite === true);
	}
	if (props.filter?.tagIds?.length) {
		const wanted = new Set(props.filter.tagIds);
		recipes = recipes.filter((r) => (r.tags ?? []).some((t) => wanted.has(t)));
	}

	const decrypted = (await decryptRecords('recipes', recipes)) as LocalRecipe[];

	// Favourites first, then newest.
	decrypted.sort((a, b) => {
		const favA = a.isFavorite ? 0 : 1;
		const favB = b.isFavorite ? 0 : 1;
		if (favA !== favB) return favA - favB;
		return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
	});

	return decrypted.map((r) => {
		const total = (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0) || null;
		const timeLabel =
			total !== null && total > 0
				? total < 60
					? `${total} Min`
					: `${Math.floor(total / 60)}h ${total % 60}m`
				: null;
		const parts = [timeLabel, `${r.servings} Port.`].filter((x): x is string => Boolean(x));
		return {
			title: r.title,
			subtitle: parts.join(' · ') || undefined,
			imageUrl: r.photoThumbnailUrl ?? r.photoUrl ?? undefined,
		};
	});
}

/**
 * Habits: build-in-public use case. Returns active habits flipped to
 * 'public' with their current streak as subtitle.
 *
 * Whitelist: title + "🔥 N Tage Streak · gesamt M ×" — never the per-log
 * timestamps or notes (those reveal sleep/intake patterns). Streak +
 * total are aggregate counts that sit at the right level of detail
 * for a public "what I'm working on" widget.
 */
async function resolveHabits(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let habits = await db.table<LocalHabit>('habits').toArray();
	habits = habits.filter(
		(h) => !h.deletedAt && !h.isArchived && canEmbedOnWebsite(h.visibility ?? 'private')
	);

	if (props.filter?.tagIds?.length) {
		// Habits don't have direct tagIds today; the filter is reserved
		// for when they do. Skip silently.
	}

	if (habits.length === 0) return [];

	const habitIds = new Set(habits.map((h) => h.id));
	const allLogs = await db.table<LocalHabitLog>('habitLogs').toArray();
	const logsByHabit = new Map<string, LocalHabitLog[]>();
	for (const log of allLogs) {
		if (log.deletedAt || !habitIds.has(log.habitId)) continue;
		const list = logsByHabit.get(log.habitId) ?? [];
		list.push(log);
		logsByHabit.set(log.habitId, list);
	}

	// Resolve each log's date via its TimeBlock (date-only, the time
	// dimension itself is intentionally not exposed).
	const blockIds = allLogs.map((l) => l.timeBlockId).filter(Boolean);
	const blocks =
		blockIds.length > 0
			? await db.table<LocalTimeBlock>('timeBlocks').where('id').anyOf(blockIds).toArray()
			: [];
	const blockDateById = new Map<string, string>();
	for (const b of blocks) blockDateById.set(b.id, (b.startDate ?? '').slice(0, 10));

	function streakFor(logs: LocalHabitLog[]): number {
		const dates = new Set<string>();
		for (const l of logs) {
			const d = blockDateById.get(l.timeBlockId);
			if (d) dates.add(d);
		}
		let streak = 0;
		const cursor = new Date();
		while (true) {
			const key = cursor.toISOString().slice(0, 10);
			if (!dates.has(key)) break;
			streak++;
			cursor.setDate(cursor.getDate() - 1);
		}
		return streak;
	}

	const decrypted = (await decryptRecords('habits', habits)) as LocalHabit[];

	// Active streak first, then total-count.
	const enriched = decrypted.map((h) => {
		const logs = logsByHabit.get(h.id) ?? [];
		return { habit: h, streak: streakFor(logs), total: logs.length };
	});
	enriched.sort((a, b) => b.streak - a.streak || b.total - a.total);

	return enriched.map(({ habit, streak, total }) => {
		const parts: string[] = [];
		if (streak > 0) parts.push(`🔥 ${streak} ${streak === 1 ? 'Tag' : 'Tage'} Streak`);
		if (total > 0) parts.push(`gesamt ${total} ×`);
		return {
			title: habit.title,
			subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
		};
	});
}

/**
 * Quizzes: shareable quiz collection use case. Returns quizzes flipped
 * to 'public' with their question count + category as subtitle.
 *
 * Whitelist: title + "N Fragen · {category}" line — questions, options,
 * explanations, attempts/scores all stay private. The teaser exists
 * to drive opens; the unlisted-share flow (future) would carry the
 * actual play-experience.
 */
async function resolveQuizzes(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let quizzes = await db.table<LocalQuiz>('quizzes').toArray();
	quizzes = quizzes.filter(
		(q) => !q.deletedAt && !q.isArchived && canEmbedOnWebsite(q.visibility ?? 'private')
	);

	if (props.filter?.tagIds?.length) {
		const wanted = new Set(props.filter.tagIds);
		quizzes = quizzes.filter((q) => (q.tags ?? []).some((t) => wanted.has(t)));
	}

	const decrypted = (await decryptRecords('quizzes', quizzes)) as LocalQuiz[];

	// Pinned first, then newest.
	decrypted.sort((a, b) => {
		const pinA = a.isPinned ? 0 : 1;
		const pinB = b.isPinned ? 0 : 1;
		if (pinA !== pinB) return pinA - pinB;
		return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
	});

	return decrypted.map((q) => {
		const count = q.questionCount ?? 0;
		const parts: string[] = [`${count} ${count === 1 ? 'Frage' : 'Fragen'}`];
		if (q.category) parts.push(q.category);
		return {
			title: q.title,
			subtitle: parts.join(' · '),
		};
	});
}

/**
 * Social-events (the events module — distinct from calendar.events).
 * Returns events flipped to 'public' with their date + location as
 * subtitle. Hard-gated on the unified `visibility`; the legacy
 * `isPublished` flag is intentionally NOT consulted here so the new
 * Picker is the single source of truth (M6 cleanup will drop the
 * legacy field entirely).
 *
 * Whitelist: title + formatted date + location — guest list, RSVP
 * counts, capacity, host contact, items/bring-list all stay private.
 */
async function resolveSocialEvents(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let events = await db.table<LocalSocialEvent>('socialEvents').toArray();
	events = events.filter(
		(e) => !e.deletedAt && e.status !== 'cancelled' && canEmbedOnWebsite(e.visibility ?? 'private')
	);

	if (events.length === 0) return [];

	// Resolve dates via TimeBlock — the time dimension lives there.
	const blockIds = events.map((e) => e.timeBlockId).filter(Boolean);
	const blocks =
		blockIds.length > 0
			? await db.table<LocalTimeBlock>('timeBlocks').where('id').anyOf(blockIds).toArray()
			: [];
	const blockById = new Map<string, LocalTimeBlock>();
	for (const b of blocks) blockById.set(b.id, b);

	if (props.filter?.upcomingDays !== undefined) {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() + props.filter.upcomingDays);
		const cutoffISO = cutoff.toISOString();
		const nowISO = new Date().toISOString();
		events = events.filter((e) => {
			const start = blockById.get(e.timeBlockId)?.startDate;
			return start && start >= nowISO && start <= cutoffISO;
		});
	}

	const decrypted = (await decryptRecords('socialEvents', events)) as LocalSocialEvent[];

	// Upcoming-first by start date.
	decrypted.sort((a, b) => {
		const sa = blockById.get(a.timeBlockId)?.startDate ?? '';
		const sb = blockById.get(b.timeBlockId)?.startDate ?? '';
		return sa.localeCompare(sb);
	});

	return decrypted.map((e) => {
		const block = blockById.get(e.timeBlockId);
		const parts: string[] = [];
		if (block?.startDate) {
			parts.push(
				formatDateTime(new Date(block.startDate), {
					day: '2-digit',
					month: 'long',
					year: 'numeric',
					hour: block.allDay ? undefined : '2-digit',
					minute: block.allDay ? undefined : '2-digit',
				})
			);
		}
		if (e.location) parts.push(e.location);
		return {
			title: e.title,
			subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
			imageUrl: e.coverImage ?? undefined,
		};
	});
}

// resolveCardDecks: dekommissioniert 2026-05-08, Cards lebt eigenständig
// auf cardecky.mana.how. Public-Deck-Embeds für Cardecky kommen später
// über die Cardecky-API.

/**
 * Presi-decks: "talks I've given" teaser. Returns decks flipped to
 * 'public' with their slide count as subtitle.
 *
 * Whitelist: title + "N Folien". Slide content (titles, body text,
 * images, bullet points) all stay private — the public deck is a
 * pointer the user can link from elsewhere; the actual slides
 * belong to the talk experience.
 */
async function resolvePresiDecks(_props: ModuleEmbedProps): Promise<EmbedItem[]> {
	let decks = await db.table<LocalPresiDeck>('presiDecks').toArray();
	decks = decks.filter((d) => !d.deletedAt && canEmbedOnWebsite(d.visibility ?? 'private'));

	if (decks.length === 0) return [];

	const decrypted = (await decryptRecords('presiDecks', decks)) as LocalPresiDeck[];

	// Newest first.
	decrypted.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

	const deckIds = decrypted.map((d) => d.id);
	const slides =
		deckIds.length > 0 ? await db.table('slides').where('deckId').anyOf(deckIds).toArray() : [];
	const slideCountByDeck = new Map<string, number>();
	for (const s of slides as Array<{ deckId: string; deletedAt?: string }>) {
		if (s.deletedAt) continue;
		slideCountByDeck.set(s.deckId, (slideCountByDeck.get(s.deckId) ?? 0) + 1);
	}

	return decrypted.map((d) => {
		const count = slideCountByDeck.get(d.id) ?? 0;
		return {
			title: d.title,
			subtitle: `${count} ${count === 1 ? 'Folie' : 'Folien'}`,
		};
	});
}

/**
 * Augur (omens / fortunes / hunches): public-divination teaser.
 * Returns entries flipped to 'public' with the kind + vibe + outcome
 * status as subtitle.
 *
 * Whitelist: claim + "{kind} · {vibe} · {outcome}". The personal
 * fields — feltMeaning, expectedOutcome, expectedBy, source name,
 * outcomeNote, related dream/decision links, livingOracleSnapshot —
 * all stay private. Augur captures are by default private (the
 * store stamps `'private'` rather than space-default), so a flip
 * to 'public' is an explicit "I want to share this prediction".
 *
 * Filters: optional `status` maps to AugurOutcome ('open' /
 * 'fulfilled' / 'partly' / 'not-fulfilled') so the user can build
 * "predictions I got right" or "still open" widgets.
 */
async function resolveAugurEntries(props: ModuleEmbedProps): Promise<EmbedItem[]> {
	const KIND_LABEL: Record<string, string> = {
		omen: 'Omen',
		fortune: 'Wahrsagung',
		hunch: 'Bauchgefühl',
	};
	const VIBE_LABEL: Record<string, string> = {
		good: 'Gutes Zeichen',
		bad: 'Warnung',
		mysterious: 'Rätselhaft',
	};
	const OUTCOME_LABEL: Record<string, string> = {
		open: 'Offen',
		fulfilled: 'Eingetreten',
		partly: 'Teilweise',
		'not-fulfilled': 'Nicht eingetreten',
	};

	let entries = await db.table<LocalAugurEntry>('augurEntries').toArray();
	entries = entries.filter(
		(e) => !e.deletedAt && !e.isArchived && canEmbedOnWebsite(e.visibility ?? 'private')
	);

	if (props.filter?.status) {
		entries = entries.filter((e) => e.outcome === props.filter?.status);
	}

	if (entries.length === 0) return [];

	const decrypted = (await decryptRecords('augurEntries', entries)) as LocalAugurEntry[];

	// Resolved-first then by encounteredAt desc — fulfilled predictions
	// rank above open ones, which is the more interesting public signal.
	decrypted.sort((a, b) => {
		const aOpen = a.outcome === 'open' ? 1 : 0;
		const bOpen = b.outcome === 'open' ? 1 : 0;
		if (aOpen !== bOpen) return aOpen - bOpen;
		return (b.encounteredAt ?? '').localeCompare(a.encounteredAt ?? '');
	});

	return decrypted.map((e) => {
		const parts = [
			KIND_LABEL[e.kind] ?? e.kind,
			VIBE_LABEL[e.vibe] ?? e.vibe,
			OUTCOME_LABEL[e.outcome] ?? e.outcome,
		];
		return {
			title: e.claim,
			subtitle: parts.join(' · '),
		};
	});
}
