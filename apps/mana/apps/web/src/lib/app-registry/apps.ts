import { formatDate } from '$lib/i18n/format';
/**
 * Unified App Registrations — All app descriptors in one file.
 *
 * Apps with entity capabilities (todo, calendar, contacts) include
 * collection, paramKey, dragType, etc. for cross-module DnD and linking.
 * All other apps only declare identity + views.
 */

import { registerApp } from './registry';
import {
	Plus,
	CheckSquare,
	Calendar,
	AddressBook,
	Repeat,
	Notepad,
	Moon,
	Drop,
	MoneyWavy,
	ChatCircle,
	Clock,
	Image,
	Camera,
	HardDrives,
	Presentation,
	Package,
	NumberCircleOne,
	Binoculars,
	ArrowsInCardinal,
	Buildings,
	Calculator,
	Lightning,
	PencilRuler,
	Person,
	GenderFemale,
	CalendarStar,
	PersonSimpleCircle,
	BookOpen,
	Books,
	CookingPot,
	PersonSimpleTaiChi,
	Envelope,
	Flower,
	SunDim,
	Pulse,
	Robot,
	Target,
	Flag,
	Notebook,
	Heartbeat,
	Smiley,
	Gear,
	Palette,
	UserCircle,
	ShieldCheck,
	Key,
	Question,
	ChatCircleDots,
	SquaresFour,
	Spiral,
	Crown,
	ShootingStar,
	CloudSun,
	Stack,
	ArrowClockwise,
	Flask,
	Exam,
	Globe,
	NotePencil,
	Hourglass,
	HeartHalf,
	Eye,
	Megaphone,
	Receipt,
	ClockCounterClockwise,
	ClipboardText,
} from '@mana/shared-icons';

// ─── INDEX ──────────────────────────────────────────────────────
//
// Apps are grouped by their workbench role. Inside each group the
// order is roughly chronological (by when they were added) — search
// by id or use your editor outline to jump to a specific app.
//
//   §1  Apps with entity capabilities (DnD sources/targets)
//       todo · calendar · contacts
//
//   §2  Apps without entity capabilities — module surfaces
//       Daily-use:    habits · notes · journal · myday · drink ·
//                     mood · sleep · activity · times · finance
//       Knowledge:    chat · kontext · cards · quiz · guides ·
//                     news-research · research-lab · articles ·
//                     library · writing · presi
//       Body & life:  body · meditate · stretch · period ·
//                     dreams · firsts · lasts · habits · recipes
//       Places & ev.: places · events
//       Creative:     picture · music · photos
//       Tools:        calc · inventory ·
//                     storage · skilltree · questions
//       Long-tail:    quotes · automations · companion · wetter ·
//                     goals · website · spaces · augur ·
//                     broadcasts · invoices · timeline
//
//   §3  AI Workbench surfaces
//       agents · ai-missions · ai-workbench · ai-policy ·
//       ai-insights · ai-health · rituals
//
//   §4  System / Settings family
//       settings · themes · profile · credits · api-keys · admin ·
//       complexity · spiral · wishes · help · feedback · playground
//
// ────────────────────────────────────────────────────────────────

// ── §1 · Apps with entity capabilities ──────────────────────

registerApp({
	id: 'todo',
	name: 'Todo',
	color: '#8B5CF6',
	icon: CheckSquare,
	views: {
		list: { load: () => import('$lib/modules/todo/ListView.svelte') },
		detail: { load: () => import('$lib/modules/todo/views/DetailView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-task',
			label: 'Neue Aufgabe',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'todo', action: 'new' } })
				),
		},
	],
	collection: 'tasks',
	paramKey: 'taskId',
	dragType: 'task',
	acceptsDropFrom: ['event', 'contact'],
	transformIncoming: {
		event: (source) => ({
			title: source.title as string,
			dueDate: source.startDate as string,
			description: source.description as string | undefined,
		}),
		contact: (source) => ({
			title: `Kontaktieren: ${[source.firstName, source.lastName].filter(Boolean).join(' ')}`,
		}),
	},
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Aufgabe',
		subtitle: item.dueDate ? formatDate(new Date(item.dueDate as string)) : undefined,
	}),
	createItem: async (data) => {
		const { tasksStore } = await import('$lib/modules/todo/stores/tasks.svelte');
		const task = await tasksStore.createTask(
			data as { title: string; dueDate?: string; description?: string }
		);
		return task.id;
	},
});

registerApp({
	id: 'calendar',
	name: 'Kalender',
	color: '#3B82F6',
	icon: Calendar,
	views: {
		list: { load: () => import('$lib/modules/calendar/ListView.svelte') },
		detail: { load: () => import('$lib/modules/calendar/views/DetailView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-event',
			label: 'Neuer Termin',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'calendar', action: 'new' } })
				),
		},
	],
	collection: 'events',
	paramKey: 'eventId',
	dragType: 'event',
	acceptsDropFrom: ['task', 'contact'],
	transformIncoming: {
		task: (source) => {
			const dueDate = (source.dueDate as string) || new Date().toISOString();
			const start = new Date(dueDate);
			const end = new Date(start.getTime() + 60 * 60 * 1000);
			return {
				title: source.title as string,
				startTime: start.toISOString(),
				endTime: end.toISOString(),
				description: source.description as string | undefined,
			};
		},
		contact: (source) => {
			const name = [source.firstName, source.lastName].filter(Boolean).join(' ');
			const now = new Date();
			const end = new Date(now.getTime() + 60 * 60 * 1000);
			return {
				title: `Treffen mit ${name}`,
				startTime: now.toISOString(),
				endTime: end.toISOString(),
			};
		},
	},
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Termin',
		subtitle: item.startDate
			? formatDate(new Date(item.startDate as string), {
					day: '2-digit',
					month: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
				})
			: undefined,
	}),
	createItem: async (data) => {
		const { db } = await import('$lib/data/database');
		const { eventsStore } = await import('$lib/modules/calendar/stores/events.svelte');

		const calendars = await db.table('calendars').toArray();
		const defaultCal = calendars.find((c: Record<string, unknown>) => !c.deletedAt);
		const calendarId = (defaultCal?.id as string) ?? 'default';

		const result = await eventsStore.createEvent({
			calendarId,
			title: data.title as string,
			startTime: data.startTime as string,
			endTime: data.endTime as string,
			description: (data.description as string) ?? undefined,
		});

		if (!result.success || !result.data) throw new Error(result.error || 'Failed to create event');
		return result.data.id;
	},
});

registerApp({
	id: 'contacts',
	name: 'Kontakte',
	color: '#22C55E',
	icon: AddressBook,
	views: {
		list: { load: () => import('$lib/modules/contacts/ListView.svelte') },
		detail: { load: () => import('$lib/modules/contacts/views/DetailView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-contact',
			label: 'Neuer Kontakt',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'contacts', action: 'new' } })
				),
		},
	],
	collection: 'contacts',
	paramKey: 'contactId',
	dragType: 'contact',
	getDisplayData: (item) => {
		const name = [item.firstName, item.lastName].filter(Boolean).join(' ');
		return {
			title: name || (item.email as string) || 'Kontakt',
			subtitle: (item.company as string) ?? undefined,
		};
	},
	// Contacts are drag sources only -- dropping onto contacts doesn't create a new contact
});

// ── Apps without entity capabilities ────────────────────────

registerApp({
	id: 'habits',
	name: 'Habits',
	color: '#8B5CF6',
	icon: Repeat,
	views: {
		list: { load: () => import('$lib/modules/habits/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-habit',
			label: 'Neues Habit',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'habits', action: 'new' } })
				),
		},
	],
	collection: 'habits',
	paramKey: 'habitId',
	dragType: 'habit',
	acceptsDropFrom: ['task'],
	transformIncoming: {
		task: (source) => ({
			title: source.title as string,
			icon: 'barbell',
			color: '#6366f1',
		}),
	},
	getDisplayData: (item) => ({
		title: item.title as string,
		subtitle: undefined,
	}),
	createItem: async (data) => {
		const { habitsStore } = await import('$lib/modules/habits/stores/habits.svelte');
		const habit = await habitsStore.createHabit({
			title: data.title as string,
			icon: (data.icon as string) ?? 'star',
			color: (data.color as string) ?? '#6366f1',
		});
		return habit.id;
	},
});

registerApp({
	id: 'notes',
	name: 'Notes',
	color: '#F59E0B',
	icon: Notepad,
	views: {
		list: { load: () => import('$lib/modules/notes/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-note',
			label: 'Neue Notiz',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'notes', action: 'new' } })
				),
		},
	],
	collection: 'notes',
	paramKey: 'noteId',
	dragType: 'note',
	acceptsDropFrom: ['task', 'contact'],
	transformIncoming: {
		task: (source) => ({
			title: source.title as string,
			content: (source.description as string) ?? '',
		}),
		contact: (source) => ({
			title: `${[source.firstName, source.lastName].filter(Boolean).join(' ')}`,
			content: `Kontakt: ${[source.firstName, source.lastName].filter(Boolean).join(' ')}`,
		}),
	},
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Notiz',
		subtitle: undefined,
	}),
	createItem: async (data) => {
		const { notesStore } = await import('$lib/modules/notes/stores/notes.svelte');
		const note = await notesStore.createNote({
			title: data.title as string,
			content: (data.content as string) ?? '',
		});
		return note.id;
	},
});

registerApp({
	id: 'journal',
	name: 'Journal',
	color: '#6366F1',
	icon: BookOpen,
	views: {
		list: { load: () => import('$lib/modules/journal/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-entry',
			label: 'Neuer Eintrag',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'journal', action: 'new' } })
				),
		},
	],
	collection: 'journalEntries',
	paramKey: 'entryId',
	dragType: 'journal-entry',
	acceptsDropFrom: ['note'],
	transformIncoming: {
		note: (source) => ({
			title: source.title as string,
			content: (source.content as string) ?? '',
		}),
	},
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Eintrag',
		subtitle: (item.entryDate as string) ?? undefined,
	}),
	createItem: async (data) => {
		const { journalStore } = await import('$lib/modules/journal/stores/journal.svelte');
		const entry = await journalStore.createEntry({
			title: (data.title as string) ?? null,
			content: (data.content as string) ?? '',
		});
		return entry.id;
	},
});

registerApp({
	id: 'dreams',
	name: 'Dreams',
	color: '#6366F1',
	icon: Moon,
	views: {
		list: { load: () => import('$lib/modules/dreams/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-dream',
			label: 'Neuer Traum',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'dreams', action: 'new' } })
				),
		},
	],
	collection: 'dreams',
	paramKey: 'dreamId',
	dragType: 'dream',
	acceptsDropFrom: ['note'],
	transformIncoming: {
		note: (source) => ({
			title: source.title as string,
			content: (source.content as string) ?? '',
		}),
	},
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Traum',
		subtitle: (item.dreamDate as string) ?? undefined,
	}),
	createItem: async (data) => {
		const { dreamsStore } = await import('$lib/modules/dreams/stores/dreams.svelte');
		const dream = await dreamsStore.createDream({
			title: (data.title as string) ?? null,
			content: (data.content as string) ?? '',
		});
		return dream.id;
	},
});

registerApp({
	id: 'period',
	name: 'Period',
	color: '#ec4899',
	icon: GenderFemale,
	views: {
		list: { load: () => import('$lib/modules/period/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'log-day',
			label: 'Tag loggen',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'period', action: 'new' } })
				),
		},
	],
	collection: 'periodDayLogs',
	paramKey: 'logId',
	getDisplayData: (item) => ({
		title: (item.logDate as string) || 'Tageseintrag',
		subtitle: (item.flow as string) ?? undefined,
	}),
	createItem: async (data) => {
		const { dayLogsStore } = await import('$lib/modules/period/stores/dayLogs.svelte');
		const log = await dayLogsStore.logDay({
			logDate: (data.logDate as string) ?? undefined,
			notes: (data.title as string) ?? null,
		});
		return log.id;
	},
});

registerApp({
	id: 'finance',
	name: 'Finance',
	color: '#22C55E',
	icon: MoneyWavy,
	views: {
		list: { load: () => import('$lib/modules/finance/ListView.svelte') },
	},
	collection: 'transactions',
	paramKey: 'transactionId',
	dragType: 'transaction',
	acceptsDropFrom: [],
	getDisplayData: (item) => ({
		title: (item.description as string) || 'Transaktion',
		subtitle: item.amount ? `${item.type === 'income' ? '+' : '-'}${item.amount}` : undefined,
	}),
	createItem: async (data) => {
		const { financeStore } = await import('$lib/modules/finance/stores/finance.svelte');
		const tx = await financeStore.addTransaction({
			type: 'expense',
			amount: (data.amount as number) ?? 0,
			description: (data.title as string) ?? (data.description as string) ?? '',
		});
		return tx.id;
	},
});

// Places-Modul: dekommissioniert 2026-05-19, lebt als viadocu standalone
// auf viadocu-api.mana.how (GPS-Reise-Tracker + Cities/Countries-Stats).

registerApp({
	id: 'chat',
	name: 'Chat',
	color: '#6366F1',
	icon: ChatCircle,
	views: {
		list: { load: () => import('$lib/modules/chat/ListView.svelte') },
		detail: { load: () => import('$lib/modules/chat/views/DetailView.svelte') },
	},
	collection: 'conversations',
	paramKey: 'conversationId',
});

registerApp({
	id: 'times',
	name: 'Times',
	color: '#F59E0B',
	icon: Clock,
	views: {
		list: { load: () => import('$lib/modules/times/ListView.svelte') },
		detail: { load: () => import('$lib/modules/times/views/DetailView.svelte') },
	},
});

// Cards-Modul: dekommissioniert 2026-05-08, Cards lebt jetzt als
// standalone-App auf cardecky.mana.how (git.mana.how/till/cards).
// Quotes-Modul: dekommissioniert 2026-05-19, lebt als zitare standalone
// auf zitare.mana.how (Code/zitare).

registerApp({
	id: 'picture',
	name: 'Picture',
	color: '#8B5CF6',
	icon: Image,
	views: {
		list: { load: () => import('$lib/modules/picture/ListView.svelte') },
	},
});

registerApp({
	id: 'photos',
	name: 'Photos',
	color: '#06B6D4',
	icon: Camera,
	views: {
		list: { load: () => import('$lib/modules/photos/ListView.svelte') },
	},
});

registerApp({
	id: 'storage',
	name: 'Storage',
	color: '#6B7280',
	icon: HardDrives,
	views: {
		list: { load: () => import('$lib/modules/storage/ListView.svelte') },
		detail: { load: () => import('$lib/modules/storage/views/DetailView.svelte') },
	},
});

registerApp({
	id: 'presi',
	name: 'Presi',
	color: '#A855F7',
	icon: Presentation,
	views: {
		list: { load: () => import('$lib/modules/presi/ListView.svelte') },
		detail: { load: () => import('$lib/modules/presi/views/DetailView.svelte') },
	},
});

registerApp({
	id: 'inventory',
	name: 'Inventar',
	color: '#78716C',
	icon: Package,
	views: {
		list: { load: () => import('$lib/modules/inventory/ListView.svelte') },
		detail: { load: () => import('$lib/modules/inventory/views/DetailView.svelte') },
	},
});

registerApp({
	id: 'questions',
	name: 'Questions',
	color: '#2563EB',
	icon: Binoculars,
	views: {
		list: { load: () => import('$lib/modules/questions/ListView.svelte') },
		detail: { load: () => import('$lib/modules/questions/views/DetailView.svelte') },
	},
});

registerApp({
	id: 'skilltree',
	name: 'SkillTree',
	color: '#D946EF',
	icon: ArrowsInCardinal,
	views: {
		list: { load: () => import('$lib/modules/skilltree/ListView.svelte') },
		detail: { load: () => import('$lib/modules/skilltree/views/DetailView.svelte') },
	},
});

registerApp({
	id: 'calc',
	name: 'Calc',
	color: '#6B7280',
	icon: Calculator,
	views: {
		list: { load: () => import('$lib/modules/calc/ListView.svelte') },
	},
});

registerApp({
	id: 'automations',
	name: 'Automations',
	color: '#8B5CF6',
	icon: Lightning,
	views: {
		list: { load: () => import('$lib/modules/automations/ListView.svelte') },
	},
});

registerApp({
	id: 'playground',
	name: 'Playground',
	color: '#9CA3AF',
	icon: PencilRuler,
	views: {
		list: { load: () => import('$lib/modules/playground/ListView.svelte') },
	},
});

registerApp({
	id: 'guides',
	name: 'Guides',
	color: '#0d9488',
	icon: Books,
	views: {
		list: { load: () => import('$lib/modules/guides/ListView.svelte') },
		detail: { load: () => import('$lib/modules/guides/views/DetailView.svelte') },
	},
	paramKey: 'guideId',
});

registerApp({
	id: 'body',
	name: 'Body',
	color: '#ef4444',
	icon: Person,
	views: {
		list: { load: () => import('$lib/modules/body/ListView.svelte') },
	},
});

registerApp({
	id: 'events',
	name: 'Events',
	color: '#f43f5e',
	icon: CalendarStar,
	views: {
		list: { load: () => import('$lib/modules/events/ListView.svelte') },
		detail: { load: () => import('$lib/modules/events/views/DetailView.svelte') },
	},
	paramKey: 'eventId',
});

registerApp({
	id: 'news-research',
	name: 'News Research',
	color: '#0891B2',
	icon: Binoculars,
	views: {
		list: { load: () => import('$lib/modules/news-research/ListView.svelte') },
	},
});

// Articles-Modul: dekommissioniert 2026-05-19, lebt als pageta standalone
// auf pageta.mana.how / pageta.com (Code/pageta).

registerApp({
	id: 'research-lab',
	name: 'Research Lab',
	color: '#8B5CF6',
	icon: Flask,
	views: {
		list: { load: () => import('$lib/modules/research-lab/ListView.svelte') },
	},
});

registerApp({
	id: 'firsts',
	name: 'Erste Male',
	color: '#F59E0B',
	icon: NumberCircleOne,
	views: {
		list: { load: () => import('$lib/modules/firsts/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-first',
			label: 'Neues erstes Mal',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'firsts', action: 'new' } })
				),
		},
	],
	collection: 'firsts',
	paramKey: 'firstId',
	dragType: 'first',
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Erstes Mal',
		subtitle: (item.date as string) ?? (item.status === 'dream' ? 'Dream' : undefined),
	}),
	createItem: async (data) => {
		const { firstsStore } = await import('$lib/modules/firsts/stores/firsts.svelte');
		const first = await firstsStore.createDream({
			title: (data.title as string) ?? 'Neues erstes Mal',
		});
		return first.id;
	},
});

registerApp({
	id: 'lasts',
	name: 'Letzte Male',
	color: '#6366f1',
	icon: Hourglass,
	views: {
		list: { load: () => import('$lib/modules/lasts/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-last',
			label: 'Neues letztes Mal',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'lasts', action: 'new' } })
				),
		},
	],
	collection: 'lasts',
	paramKey: 'lastId',
	dragType: 'last',
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Letztes Mal',
		subtitle: (item.date as string) ?? (item.status === 'suspected' ? 'Vermutet' : undefined),
	}),
	createItem: async (data) => {
		const { lastsStore } = await import('$lib/modules/lasts/stores/items.svelte');
		const last = await lastsStore.createSuspected({
			title: (data.title as string) ?? 'Neues letztes Mal',
		});
		return last.id;
	},
});

registerApp({
	id: 'drink',
	name: 'Drink',
	color: '#3b82f6',
	icon: Drop,
	views: {
		list: { load: () => import('$lib/modules/drink/ListView.svelte') },
	},
});

registerApp({
	id: 'recipes',
	name: 'Rezepte',
	color: '#f97316',
	icon: CookingPot,
	views: {
		list: { load: () => import('$lib/modules/recipes/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-recipe',
			label: 'Neues Rezept',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'recipes', action: 'new' } })
				),
		},
	],
});

registerApp({
	id: 'stretch',
	name: 'Stretch',
	color: '#10b981',
	icon: PersonSimpleTaiChi,
	views: {
		list: { load: () => import('$lib/modules/stretch/ListView.svelte') },
	},
});

registerApp({
	id: 'mail',
	name: 'Mail',
	color: '#6366f1',
	icon: Envelope,
	views: {
		list: { load: () => import('$lib/modules/mail/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-mail',
			label: 'Neue Mail',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'mail', action: 'compose' } })
				),
		},
	],
});

registerApp({
	id: 'meditate',
	name: 'Meditate',
	color: '#8b5cf6',
	icon: Flower,
	views: {
		list: { load: () => import('$lib/modules/meditate/ListView.svelte') },
	},
});

registerApp({
	id: 'mood',
	name: 'Mood',
	color: '#f59e0b',
	icon: Smiley,
	views: {
		list: { load: () => import('$lib/modules/mood/ListView.svelte') },
	},
});

registerApp({
	id: 'sleep',
	name: 'Sleep',
	color: '#6366f1',
	icon: Moon,
	views: {
		list: { load: () => import('$lib/modules/sleep/ListView.svelte') },
	},
});

// ── Companion Brain Pages ─────────────────────────────

registerApp({
	id: 'myday',
	name: 'Mein Tag',
	color: '#F59E0B',
	icon: SunDim,
	views: {
		list: { load: () => import('$lib/modules/myday/ListView.svelte') },
	},
});

registerApp({
	id: 'activity',
	name: 'Events',
	color: '#6366F1',
	icon: Pulse,
	views: {
		list: { load: () => import('$lib/modules/activity/ListView.svelte') },
	},
});

registerApp({
	id: 'companion',
	name: 'Companion',
	color: '#8B5CF6',
	icon: Robot,
	views: {
		list: { load: () => import('$lib/modules/companion/ListView.svelte') },
	},
});

// ── AI Workbench apps — each feature is its own top-level app so it
// can live alongside other modules in the user's scene. Colors loosely
// group them: green=missions, amber=audit, pink=rituals, orange=policy,
// violet=insights, emerald=health.

registerApp({
	id: 'ai-missions',
	name: 'AI Missions',
	color: '#22C55E',
	icon: Flag,
	views: {
		list: { load: () => import('$lib/modules/ai-missions/ListView.svelte') },
	},
});

registerApp({
	// Public id matches MANA_APPS + the route URL `/agents`. The module
	// folder is named `ai-agents` for grouping with other ai-* modules.
	id: 'agents',
	name: 'AI Agents',
	color: '#8B5CF6',
	icon: Flag,
	views: {
		list: { load: () => import('$lib/modules/ai-agents/ListView.svelte') },
	},
});

registerApp({
	id: 'ai-workbench',
	name: 'AI Workbench',
	color: '#F59E0B',
	icon: Notebook,
	views: {
		list: { load: () => import('$lib/modules/ai-workbench/ListView.svelte') },
	},
});

registerApp({
	id: 'rituals',
	name: 'Rituale',
	color: '#EC4899',
	icon: ArrowClockwise,
	views: {
		list: { load: () => import('$lib/modules/rituals/ListView.svelte') },
	},
});

registerApp({
	id: 'ai-policy',
	name: 'AI Policy',
	color: '#F97316',
	icon: Flag,
	views: {
		list: { load: () => import('$lib/modules/ai-policy/ListView.svelte') },
	},
});

registerApp({
	id: 'ai-insights',
	name: 'AI Insights',
	color: '#8B5CF6',
	icon: Notebook,
	views: {
		list: { load: () => import('$lib/modules/ai-insights/ListView.svelte') },
	},
});

registerApp({
	id: 'ai-health',
	name: 'AI Health',
	color: '#10B981',
	icon: Heartbeat,
	views: {
		list: { load: () => import('$lib/modules/ai-health/ListView.svelte') },
	},
});

registerApp({
	id: 'goals',
	name: 'Ziele',
	color: '#10B981',
	icon: Target,
	views: {
		list: { load: () => import('$lib/modules/goals/ListView.svelte') },
	},
});

registerApp({
	id: 'credits',
	name: 'Credits & Abo',
	color: '#F59E0B',
	icon: Crown,
	views: {
		list: { load: () => import('$lib/modules/credits/ListView.svelte') },
	},
});

registerApp({
	id: 'spiral',
	name: 'Mana Spiral',
	color: '#6366F1',
	icon: Spiral,
	views: {
		list: { load: () => import('$lib/modules/spiral/ListView.svelte') },
	},
});

// ── System Pages ─────────────────────────────────────

registerApp({
	id: 'settings',
	name: 'Einstellungen',
	color: '#6B7280',
	icon: Gear,
	views: {
		list: { load: () => import('$lib/modules/settings/ListView.svelte') },
	},
});

registerApp({
	id: 'themes',
	name: 'Themes',
	color: '#EC4899',
	icon: Palette,
	views: {
		list: { load: () => import('$lib/modules/themes/ListView.svelte') },
	},
});

registerApp({
	id: 'profile',
	name: 'Profil',
	color: '#6366F1',
	icon: UserCircle,
	views: {
		list: { load: () => import('$lib/modules/profile/ListView.svelte') },
	},
});

registerApp({
	id: 'admin',
	name: 'Admin',
	color: '#EF4444',
	icon: ShieldCheck,
	views: {
		list: { load: () => import('$lib/modules/admin/ListView.svelte') },
	},
});

registerApp({
	id: 'complexity',
	name: 'Complexity',
	color: '#0EA5E9',
	icon: SquaresFour,
	views: {
		list: { load: () => import('$lib/modules/complexity/ListView.svelte') },
	},
});

registerApp({
	id: 'api-keys',
	name: 'API Keys',
	color: '#F59E0B',
	icon: Key,
	views: {
		list: { load: () => import('$lib/modules/api-keys/ListView.svelte') },
	},
});

registerApp({
	id: 'wishes',
	name: 'Wünsche',
	color: '#F59E0B',
	icon: ShootingStar,
	views: {
		list: { load: () => import('$lib/modules/wishes/ListView.svelte') },
		detail: { load: () => import('$lib/modules/wishes/views/DetailView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-wish',
			label: 'Neuer Wunsch',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'wishes', action: 'new' } })
				),
		},
	],
	collection: 'wishesItems',
	paramKey: 'wishId',
	dragType: 'wish',
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Wunsch',
		subtitle: item.targetPrice
			? `${(item.targetPrice as number).toLocaleString('de-DE')} €`
			: undefined,
	}),
	createItem: async (data) => {
		const { wishesStore } = await import('$lib/modules/wishes/stores/wishes.svelte');
		const wish = await wishesStore.create({
			title: data.title as string,
			description: data.description as string | undefined,
		});
		return wish.id;
	},
});

registerApp({
	id: 'help',
	name: 'Hilfe',
	color: '#3B82F6',
	icon: Question,
	views: {
		list: { load: () => import('$lib/modules/help/ListView.svelte') },
	},
});

registerApp({
	id: 'wetter',
	name: 'Wetter',
	color: '#38bdf8',
	icon: CloudSun,
	views: {
		list: { load: () => import('$lib/modules/wetter/ListView.svelte') },
	},
});

registerApp({
	id: 'feedback',
	name: 'Feedback',
	color: '#F59E0B',
	icon: HeartHalf,
	views: {
		list: { load: () => import('$lib/modules/feedback/ListView.svelte') },
	},
});

registerApp({
	id: 'library',
	name: 'Bibliothek',
	color: '#a855f7',
	icon: Stack,
	views: {
		// Detail view uses the route-based pattern (/library/entry/[id]); the
		// workbench detail-slot (ViewProps params/navigate) pattern is not
		// wired up yet. Clicks on a card in the list view navigate via goto().
		list: { load: () => import('$lib/modules/library/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-entry',
			label: 'Neuer Eintrag',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'library', action: 'new' } })
				),
		},
	],
});

registerApp({
	id: 'writing',
	name: 'Schreiben',
	color: '#0ea5e9',
	icon: NotePencil,
	views: {
		// Detail view (/writing/draft/[id]) uses goto() from the list view,
		// same pattern as library. Workbench detail-slot not wired yet.
		list: { load: () => import('$lib/modules/writing/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-draft',
			label: 'Neuer Draft',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'writing', action: 'new' } })
				),
		},
	],
	collection: 'writingDrafts',
	paramKey: 'draftId',
	dragType: 'draft',
	getDisplayData: (item) => ({
		title: (item.title as string) || (item.topic as string) || 'Draft',
		subtitle:
			typeof item.wordCount === 'number' && item.wordCount > 0
				? `${item.wordCount} Wörter`
				: undefined,
	}),
});

registerApp({
	id: 'spaces',
	name: 'Spaces',
	color: '#14b8a6',
	icon: UserCircle,
	views: {
		list: { load: () => import('$lib/modules/spaces/ListView.svelte') },
	},
});

registerApp({
	id: 'website',
	name: 'Website',
	color: '#6366f1',
	icon: Globe,
	views: {
		list: { load: () => import('$lib/modules/website/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-site',
			label: 'Neue Website',
			icon: Plus,
			action: () => {
				window.location.href = '/website/new';
			},
		},
	],
});

registerApp({
	id: 'quiz',
	name: 'Quiz',
	color: '#ec4899',
	icon: Exam,
	views: {
		// Edit (/quiz/[id]/edit) and Play (/quiz/[id]/play) use route-based
		// navigation via goto(); the workbench detail-slot isn't wired yet.
		list: { load: () => import('$lib/modules/quiz/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-quiz',
			label: 'Neues Quiz',
			icon: Plus,
			action: () =>
				window.dispatchEvent(
					new CustomEvent('mana:quick-action', { detail: { app: 'quiz', action: 'new' } })
				),
		},
	],
	collection: 'quizzes',
	paramKey: 'quizId',
	getDisplayData: (item) => ({
		title: (item.title as string) || 'Quiz',
		subtitle: (item.category as string) || undefined,
	}),
	createItem: async (data) => {
		const { quizzesStore } = await import('$lib/modules/quiz/stores/quizzes.svelte');
		const quiz = await quizzesStore.createQuiz({
			title: (data.title as string) || 'Neues Quiz',
		});
		return quiz.id;
	},
});

registerApp({
	id: 'augur',
	name: 'Augur',
	color: '#7c3aed',
	icon: Eye,
	views: {
		// Witness/Oracle modes live inside the ListView; detail (/augur/entry/[id])
		// and recap (/augur/recap) navigate via goto().
		list: { load: () => import('$lib/modules/augur/ListView.svelte') },
	},
});

registerApp({
	id: 'broadcasts',
	name: 'Broadcasts',
	color: '#6366f1',
	icon: Megaphone,
	views: {
		// Detail (/broadcasts/[id]), new (/broadcasts/new) and settings live
		// as SvelteKit routes; the workbench card hosts the ListView root.
		list: { load: () => import('$lib/modules/broadcasts/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-campaign',
			label: 'Neue Kampagne',
			icon: Plus,
			action: () => {
				window.location.href = '/broadcasts/new';
			},
		},
	],
});

registerApp({
	id: 'invoices',
	name: 'Rechnungen',
	color: '#059669',
	icon: Receipt,
	views: {
		// Detail (/invoices/[id]), new (/invoices/new) and settings live as
		// SvelteKit routes; the workbench card hosts the ListView root.
		list: { load: () => import('$lib/modules/invoices/ListView.svelte') },
	},
	contextMenuActions: [
		{
			id: 'new-invoice',
			label: 'Neue Rechnung',
			icon: Plus,
			action: () => {
				window.location.href = '/invoices/new';
			},
		},
	],
});

registerApp({
	id: 'timeline',
	name: 'Timeline',
	color: '#f59e0b',
	icon: ClockCounterClockwise,
	views: {
		// Cross-module read-only view — reads timeBlocks owned by core.
		// /timeline/analytics navigates via goto() from the route page.
		list: { load: () => import('$lib/modules/timeline/ListView.svelte') },
	},
});

registerApp({
	id: 'forms',
	name: 'Forms',
	color: '#14b8a6',
	icon: ClipboardText,
	views: {
		// /forms/[id]/edit (builder) and /forms/[id]/responses (analytics)
		// live as SvelteKit routes; the workbench card hosts the ListView.
		list: { load: () => import('$lib/modules/forms/ListView.svelte') },
	},
});
