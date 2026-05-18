/**
 * MCP Tool Executor — handles tools/call requests by routing to
 * sync database reads and writes.
 *
 * Read tools query sync_changes to reconstruct current user state.
 * Write tools INSERT into sync_changes — records appear on the user's
 * devices on their next sync cycle.
 *
 * Uses the same sync_changes pattern as mana-ai's iteration-writer,
 * with actor attribution as 'system:mcp'.
 */

import { AI_TOOL_CATALOG_BY_NAME } from '@mana/shared-ai';
import { readLatestRecords, writeRecord } from './sync-db';

export interface McpToolResult {
	[key: string]: unknown;
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
}

// ── Tool handler registry ──────────────────────────────────────
type ToolHandler = (args: Record<string, unknown>, userId: string) => Promise<McpToolResult>;

const handlers = new Map<string, ToolHandler>();

function register(name: string, handler: ToolHandler): void {
	handlers.set(name, handler);
}

// ── Helpers ────────────────────────────────────────────────────

function ok(text: string, data?: unknown): McpToolResult {
	return {
		content: [{ type: 'text', text: data ? `${text}\n\n${JSON.stringify(data, null, 2)}` : text }],
	};
}

function err(text: string): McpToolResult {
	return { content: [{ type: 'text', text }], isError: true };
}

function nowIso(): string {
	return new Date().toISOString();
}

function fieldTs(fields: string[]): Record<string, string> {
	const ts = nowIso();
	return Object.fromEntries(fields.map((f) => [f, ts]));
}

// ── Todo tools ─────────────────────────────────────────────────

register('list_tasks', async (_args, userId) => {
	const records = await readLatestRecords(userId, 'todo', 'tasks');
	const filter = (_args.filter as string) ?? 'open';
	const limit = (_args.limit as number) ?? 20;
	const today = new Date().toISOString().split('T')[0];

	let tasks = records.map((r) => ({
		id: r.id as string,
		title: r.title as string,
		dueDate: r.dueDate as string | undefined,
		priority: r.priority as string | undefined,
		isCompleted: !!r.isCompleted,
	}));

	if (filter === 'open') tasks = tasks.filter((t) => !t.isCompleted);
	else if (filter === 'completed') tasks = tasks.filter((t) => t.isCompleted);
	else if (filter === 'overdue')
		tasks = tasks.filter((t) => !t.isCompleted && t.dueDate != null && t.dueDate < today);
	else if (filter === 'today') tasks = tasks.filter((t) => !t.isCompleted && t.dueDate === today);

	const list = tasks.slice(0, limit);
	if (list.length === 0) return ok(`Keine ${filter} Tasks.`);

	const lines = list.map(
		(t) =>
			`- [${t.id}] ${t.title}${t.dueDate ? ` (fällig ${t.dueDate})` : ''}${t.priority === 'high' ? ' [HOHE PRIO]' : ''}`
	);
	return ok(`${list.length} Tasks (${filter}):\n${lines.join('\n')}`, list);
});

register('get_task_stats', async (_args, userId) => {
	const records = await readLatestRecords(userId, 'todo', 'tasks');
	const today = new Date().toISOString().split('T')[0];
	const total = records.length;
	const completed = records.filter((r) => r.isCompleted).length;
	const overdue = records.filter(
		(r) => !r.isCompleted && r.dueDate != null && (r.dueDate as string) < today
	).length;
	const dueToday = records.filter((r) => !r.isCompleted && (r.dueDate as string) === today).length;

	return ok(
		`${total} Tasks: ${completed} erledigt, ${overdue} überfällig, ${dueToday} heute fällig`,
		{ total, completed, overdue, dueToday, open: total - completed }
	);
});

register('create_task', async (args, userId) => {
	const taskId = crypto.randomUUID();
	const now = nowIso();
	const data = {
		id: taskId,
		userId,
		title: args.title as string,
		description: (args.description as string) ?? '',
		dueDate: (args.dueDate as string) ?? null,
		priority: (args.priority as string) ?? 'medium',
		isCompleted: false,
		order: 0,
		createdAt: now,
		updatedAt: now,
	};

	await writeRecord(userId, 'todo', 'tasks', taskId, 'insert', data, fieldTs(Object.keys(data)));

	return ok(`Task "${args.title}" erstellt (ID: ${taskId}). Erscheint beim nächsten Sync.`, {
		id: taskId,
	});
});

register('complete_task', async (args, userId) => {
	const taskId = args.taskId as string;
	const now = nowIso();

	await writeRecord(
		userId,
		'todo',
		'tasks',
		taskId,
		'update',
		{
			isCompleted: true,
			completedAt: now,
			updatedAt: now,
		},
		fieldTs(['isCompleted', 'completedAt', 'updatedAt'])
	);

	return ok(`Task ${taskId} als erledigt markiert.`);
});

// ── Notes tools ────────────────────────────────────────────────

register('list_notes', async (args, userId) => {
	const records = await readLatestRecords(userId, 'notes', 'notes');
	const limit = (args.limit as number) ?? 30;
	const query = (args.query as string)?.toLowerCase();

	let notes = records.map((r) => ({
		id: r.id as string,
		title: (r.title as string) ?? '(Ohne Titel)',
		excerpt: ((r.content as string) ?? '').slice(0, 100),
	}));

	if (query) {
		notes = notes.filter(
			(n) => n.title.toLowerCase().includes(query) || n.excerpt.toLowerCase().includes(query)
		);
	}

	const list = notes.slice(0, limit);
	if (list.length === 0) return ok('Keine Notizen gefunden.');

	const lines = list.map((n) => `- [${n.id}] ${n.title}: ${n.excerpt}…`);
	return ok(`${list.length} Notizen:\n${lines.join('\n')}`, list);
});

register('create_note', async (args, userId) => {
	const noteId = crypto.randomUUID();
	const now = nowIso();
	const data = {
		id: noteId,
		userId,
		title: (args.title as string) ?? '',
		content: (args.content as string) ?? '',
		createdAt: now,
		updatedAt: now,
	};

	await writeRecord(userId, 'notes', 'notes', noteId, 'insert', data, fieldTs(Object.keys(data)));
	return ok(`Notiz "${data.title || '(Ohne Titel)'}" erstellt (ID: ${noteId}).`, { id: noteId });
});

// ── Calendar tools ─────────────────────────────────────────────

register('get_todays_events', async (_args, userId) => {
	const records = await readLatestRecords(userId, 'calendar', 'timeBlocks');
	const today = new Date().toISOString().split('T')[0];

	const events = records
		.filter(
			(r) =>
				r.type === 'event' &&
				r.sourceModule === 'calendar' &&
				(r.startDate as string)?.startsWith(today)
		)
		.map((r) => ({
			id: r.sourceId as string,
			title: r.title as string,
			startTime: r.startDate as string,
			endTime: r.endDate as string,
		}))
		.sort((a, b) => a.startTime.localeCompare(b.startTime));

	if (events.length === 0) return ok('Keine Termine heute.');
	const lines = events.map((e) => `- ${e.startTime.slice(11, 16)} ${e.title}`);
	return ok(`${events.length} Termine heute:\n${lines.join('\n')}`, events);
});

// ── Contacts tools ─────────────────────────────────────────────

register('get_contacts', async (_args, userId) => {
	const records = await readLatestRecords(userId, 'contacts', 'contacts');
	const contacts = records
		.filter((r) => !r.isArchived)
		.map((r) => ({
			id: r.id as string,
			name: [r.firstName, r.lastName].filter(Boolean).join(' '),
			company: r.company as string | undefined,
			email: r.email as string | undefined,
		}));

	if (contacts.length === 0) return ok('Keine Kontakte.');
	return ok(`${contacts.length} Kontakte`, contacts);
});

register('create_contact', async (args, userId) => {
	const contactId = crypto.randomUUID();
	const now = nowIso();
	const data = {
		id: contactId,
		userId,
		firstName: args.firstName as string,
		lastName: (args.lastName as string) ?? '',
		email: (args.email as string) ?? '',
		phone: (args.phone as string) ?? '',
		company: (args.company as string) ?? '',
		notes: (args.notes as string) ?? '',
		createdAt: now,
		updatedAt: now,
	};

	await writeRecord(
		userId,
		'contacts',
		'contacts',
		contactId,
		'insert',
		data,
		fieldTs(Object.keys(data))
	);

	return ok(`Kontakt "${args.firstName}" erstellt (ID: ${contactId}).`, { id: contactId });
});

register('complete_tasks_by_title', async (args, userId) => {
	const records = await readLatestRecords(userId, 'todo', 'tasks');
	const needle = (args.titleMatch as string).toLowerCase().trim();
	const matches = records.filter(
		(r) => !r.isCompleted && !r.deletedAt && (r.title as string).toLowerCase().includes(needle)
	);
	if (matches.length === 0) return err(`Kein offener Task mit "${args.titleMatch}" gefunden.`);

	const now = nowIso();
	for (const m of matches) {
		await writeRecord(
			userId,
			'todo',
			'tasks',
			m.id as string,
			'update',
			{
				isCompleted: true,
				completedAt: now,
				updatedAt: now,
			},
			fieldTs(['isCompleted', 'completedAt', 'updatedAt'])
		);
	}
	const titles = matches.map((m) => m.title as string);
	return ok(`${matches.length} Task(s) erledigt: ${titles.join(', ')}`, {
		completed: matches.length,
		titles,
	});
});

// ── Calendar tools (write) ────────────────────────────────────

register('create_event', async (args, userId) => {
	const eventId = crypto.randomUUID();
	const blockId = crypto.randomUUID();
	const now = nowIso();

	// Create the timeBlock (unified scheduling model)
	const blockData = {
		id: blockId,
		userId,
		kind: 'absolute',
		type: 'event',
		sourceModule: 'calendar',
		sourceId: eventId,
		startDate: args.startTime as string,
		endDate: args.endTime as string,
		allDay: (args.isAllDay as boolean) ?? false,
		title: args.title as string,
		createdAt: now,
		updatedAt: now,
	};
	await writeRecord(
		userId,
		'timeblocks',
		'timeBlocks',
		blockId,
		'insert',
		blockData,
		fieldTs(Object.keys(blockData))
	);

	// Create the event record
	const eventData = {
		id: eventId,
		userId,
		calendarId: 'default',
		timeBlockId: blockId,
		location: (args.location as string) ?? '',
		description: (args.description as string) ?? '',
		createdAt: now,
		updatedAt: now,
	};
	await writeRecord(
		userId,
		'calendar',
		'events',
		eventId,
		'insert',
		eventData,
		fieldTs(Object.keys(eventData))
	);

	return ok(`Termin "${args.title}" erstellt.`, { id: eventId });
});

// ── Notes tools (write) ───────────────────────────────────────

register('update_note', async (args, userId) => {
	const noteId = args.noteId as string;
	const now = nowIso();
	const data: Record<string, unknown> = { updatedAt: now };
	const fields = ['updatedAt'];
	if (args.title !== undefined) {
		data.title = args.title;
		fields.push('title');
	}
	if (args.content !== undefined) {
		data.content = args.content;
		fields.push('content');
	}

	await writeRecord(userId, 'notes', 'notes', noteId, 'update', data, fieldTs(fields));
	return ok(`Notiz ${noteId} aktualisiert.`);
});

register('append_to_note', async (args, userId) => {
	// Read current content, append, then write full update
	const records = await readLatestRecords(userId, 'notes', 'notes');
	const note = records.find((r) => r.id === args.noteId);
	if (!note) return err(`Notiz ${args.noteId} nicht gefunden.`);

	const now = nowIso();
	const newContent = ((note.content as string) ?? '') + '\n' + (args.content as string);
	await writeRecord(
		userId,
		'notes',
		'notes',
		args.noteId as string,
		'update',
		{
			content: newContent,
			updatedAt: now,
		},
		fieldTs(['content', 'updatedAt'])
	);
	return ok(`Text an Notiz angehängt.`);
});

register('add_tag_to_note', async (args, userId) => {
	const tagId = crypto.randomUUID();
	const now = nowIso();
	const data = {
		id: tagId,
		noteId: args.noteId as string,
		tagId: (args.tag as string).replace(/\s+/g, '_'),
		createdAt: now,
	};
	await writeRecord(userId, 'notes', 'noteTags', tagId, 'insert', data, fieldTs(Object.keys(data)));
	return ok(`Tag "#${args.tag}" zur Notiz hinzugefügt.`);
});

// ── Places tools ──────────────────────────────────────────────

register('create_place', async (args, userId) => {
	const placeId = crypto.randomUUID();
	const now = nowIso();
	const data = {
		id: placeId,
		userId,
		name: args.name as string,
		latitude: args.latitude as number,
		longitude: args.longitude as number,
		category: (args.category as string) ?? 'other',
		address: (args.address as string) ?? '',
		visitCount: 0,
		createdAt: now,
		updatedAt: now,
	};
	await writeRecord(
		userId,
		'places',
		'places',
		placeId,
		'insert',
		data,
		fieldTs(Object.keys(data))
	);
	return ok(`Ort "${args.name}" erstellt.`, { id: placeId });
});

register('visit_place', async (args, userId) => {
	const logId = crypto.randomUUID();
	const now = nowIso();
	await writeRecord(
		userId,
		'places',
		'locationLogs',
		logId,
		'insert',
		{
			id: logId,
			placeId: args.placeId as string,
			timestamp: now,
			createdAt: now,
		},
		fieldTs(['id', 'placeId', 'timestamp', 'createdAt'])
	);
	return ok(`Besuch an Ort ${args.placeId} registriert.`);
});

register('get_places', async (_args, userId) => {
	const records = await readLatestRecords(userId, 'places', 'places');
	const places = records
		.filter((r) => !r.isArchived)
		.map((r) => ({ id: r.id, name: r.name, category: r.category, visitCount: r.visitCount }));
	if (places.length === 0) return ok('Keine Orte gespeichert.');
	return ok(`${places.length} Orte`, places);
});

// ── Drink tools ───────────────────────────────────────────────

register('log_drink', async (args, userId) => {
	const entryId = crypto.randomUUID();
	const now = nowIso();
	const today = now.split('T')[0];
	const data = {
		id: entryId,
		userId,
		drinkType: args.drinkType as string,
		quantityMl: args.quantityMl as number,
		name: (args.name as string) ?? (args.drinkType as string),
		date: today,
		createdAt: now,
		updatedAt: now,
	};
	await writeRecord(
		userId,
		'drink',
		'drinkEntries',
		entryId,
		'insert',
		data,
		fieldTs(Object.keys(data))
	);
	return ok(`${args.quantityMl}ml ${args.name ?? args.drinkType} geloggt.`);
});

register('get_drink_progress', async (_args, userId) => {
	const records = await readLatestRecords(userId, 'drink', 'drinkEntries');
	const today = new Date().toISOString().split('T')[0];
	const todayEntries = records.filter((r) => r.date === today);
	let waterMl = 0,
		totalMl = 0,
		coffeeCount = 0;
	for (const d of todayEntries) {
		const ml = (d.quantityMl as number) ?? 0;
		totalMl += ml;
		if (d.drinkType === 'water') waterMl += ml;
		if (d.drinkType === 'coffee') coffeeCount++;
	}
	return ok(`Heute: ${totalMl}ml gesamt, ${waterMl}ml Wasser, ${coffeeCount} Kaffee`, {
		water: waterMl,
		total: totalMl,
		coffeeCount,
		entries: todayEntries.length,
	});
});

register('undo_drink', async (_args, userId) => {
	const records = await readLatestRecords(userId, 'drink', 'drinkEntries');
	const today = new Date().toISOString().split('T')[0];
	const todayEntries = records
		.filter((r) => r.date === today)
		.sort((a, b) => ((b.createdAt as string) ?? '').localeCompare((a.createdAt as string) ?? ''));
	if (todayEntries.length === 0) return err('Kein Drink-Eintrag zum Rückgängigmachen.');
	const last = todayEntries[0];
	const now = nowIso();
	await writeRecord(
		userId,
		'drink',
		'drinkEntries',
		last.id as string,
		'update',
		{
			deletedAt: now,
			updatedAt: now,
		},
		fieldTs(['deletedAt', 'updatedAt'])
	);
	return ok(`Letzter Drink-Eintrag (${last.name}) rückgängig gemacht.`);
});

// ── Journal tools ─────────────────────────────────────────────

register('create_journal_entry', async (args, userId) => {
	const entryId = crypto.randomUUID();
	const now = nowIso();
	const today = now.split('T')[0];
	const data = {
		id: entryId,
		userId,
		content: args.content as string,
		title: (args.title as string) ?? '',
		mood: (args.mood as string) ?? null,
		entryDate: today,
		createdAt: now,
		updatedAt: now,
	};
	await writeRecord(
		userId,
		'journal',
		'journalEntries',
		entryId,
		'insert',
		data,
		fieldTs(Object.keys(data))
	);
	return ok(`Journal-Eintrag erstellt.`, { id: entryId });
});

// ── Habits tools ──────────────────────────────────────────────

register('get_habits', async (_args, userId) => {
	const records = await readLatestRecords(userId, 'habits', 'habits');
	const habits = records
		.filter((r) => !r.isArchived)
		.map((r) => ({ id: r.id, title: r.title, icon: r.icon, color: r.color }));
	if (habits.length === 0) return ok('Keine Habits.');
	return ok(`${habits.length} Habits`, habits);
});

register('create_habit', async (args, userId) => {
	const habitId = crypto.randomUUID();
	const now = nowIso();
	const data = {
		id: habitId,
		userId,
		title: args.title as string,
		icon: args.icon as string,
		color: args.color as string,
		order: 0,
		createdAt: now,
		updatedAt: now,
	};
	await writeRecord(
		userId,
		'habits',
		'habits',
		habitId,
		'insert',
		data,
		fieldTs(Object.keys(data))
	);
	return ok(`Habit "${args.title}" erstellt.`, { id: habitId });
});

register('log_habit', async (args, userId) => {
	const logId = crypto.randomUUID();
	const blockId = crypto.randomUUID();
	const now = nowIso();
	const data = {
		id: logId,
		habitId: args.habitId as string,
		timeBlockId: blockId,
		note: (args.note as string) ?? '',
		createdAt: now,
	};
	await writeRecord(
		userId,
		'habits',
		'habitLogs',
		logId,
		'insert',
		data,
		fieldTs(Object.keys(data))
	);
	return ok(`Habit geloggt.`);
});

// ── News tools ────────────────────────────────────────────────

register('save_news_article', async (args, userId) => {
	const articleId = crypto.randomUUID();
	const now = nowIso();
	const data = {
		id: articleId,
		userId,
		url: args.url as string,
		title: (args.title as string) ?? '',
		summary: (args.summary as string) ?? '',
		savedAt: now,
		createdAt: now,
		updatedAt: now,
	};
	await writeRecord(
		userId,
		'news',
		'savedArticles',
		articleId,
		'insert',
		data,
		fieldTs(Object.keys(data))
	);
	return ok(`Artikel gespeichert: "${args.title || args.url}"`, { id: articleId });
});

// ── Entry point ────────────────────────────────────────────────

/**
 * Execute an MCP tool call. Routes to registered handlers or returns
 * a "not yet implemented" message for tools without a handler.
 */
export async function executeMcpTool(
	toolName: string,
	args: Record<string, unknown>,
	userId: string
): Promise<McpToolResult> {
	const schema = AI_TOOL_CATALOG_BY_NAME.get(toolName);
	if (!schema) return err(`Unknown tool: ${toolName}`);

	const handler = handlers.get(toolName);
	if (handler) {
		try {
			return await handler(args, userId);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return err(`Tool "${toolName}" failed: ${msg}`);
		}
	}

	// Fallback for tools without a handler yet
	return ok(
		`[Mana MCP] Tool "${toolName}" (${schema.module}) ist noch nicht serverseitig implementiert.\n` +
			`Args: ${JSON.stringify(args)}\n` +
			`Nutze die Mana-App unter mana.how für diese Aktion.`
	);
}
