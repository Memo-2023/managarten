/**
 * AI Tool Catalog — single source of truth for all tool schemas.
 *
 * Both the webapp (policy, planner prompt, executor) and the server-side
 * mana-ai service (planner prompt, drift guard) derive their tool lists
 * from this catalog. Adding a new tool:
 *
 *   1. Add its schema here with `defaultPolicy`
 *   2. Add the `execute` function in the webapp module's `tools.ts`
 *   3. Done — policy, server tools, and proposable list derive automatically
 *
 * The `defaultPolicy` field determines how the tool behaves by default:
 *   - `'propose'` — AI writes go through the Proposal review workflow
 *   - `'auto'`    — executes immediately during the reasoning loop (read-only / append-only)
 */

import type { PolicyDecision } from '../policy/types';

export interface ToolSchema {
	readonly name: string;
	readonly module: string;
	readonly description: string;
	readonly defaultPolicy: PolicyDecision;
	readonly parameters: ReadonlyArray<{
		readonly name: string;
		readonly type: string;
		readonly required: boolean;
		readonly description: string;
		readonly enum?: readonly string[];
	}>;
}

// ═══════════════════════════════════════════════════════════════
//  TOOL CATALOG
// ═══════════════════════════════════════════════════════════════

export const AI_TOOL_CATALOG: readonly ToolSchema[] = [
	// ── Todo ──────────────────────────────────────────────────
	{
		name: 'create_task',
		module: 'todo',
		description: 'Erstellt einen neuen Task mit optionalem Faelligkeitsdatum und Prioritaet',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'title', type: 'string', description: 'Titel des Tasks', required: true },
			{
				name: 'dueDate',
				type: 'string',
				description: 'Faelligkeitsdatum (YYYY-MM-DD)',
				required: false,
			},
			{
				name: 'priority',
				type: 'string',
				description: 'Prioritaet',
				required: false,
				enum: ['low', 'medium', 'high'],
			},
			{ name: 'description', type: 'string', description: 'Beschreibung', required: false },
		],
	},
	{
		name: 'complete_task',
		module: 'todo',
		description: 'Markiert einen Task als erledigt',
		defaultPolicy: 'propose',
		parameters: [{ name: 'taskId', type: 'string', description: 'ID des Tasks', required: true }],
	},
	{
		name: 'complete_tasks_by_title',
		module: 'todo',
		description:
			'Markiert alle offenen Tasks mit dem gegebenen Titel als erledigt (case-insensitive Substring-Match). Nutze diese, wenn der Nutzer eine Task per Name erledigen will und du nicht ihre ID kennst.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'titleMatch',
				type: 'string',
				description: 'Titel oder Teil davon',
				required: true,
			},
		],
	},
	{
		name: 'get_task_stats',
		module: 'todo',
		description:
			'Gibt Statistiken ueber alle Tasks zurueck (total, erledigt, ueberfaellig, heute faellig)',
		defaultPolicy: 'auto',
		parameters: [],
	},
	{
		name: 'list_tasks',
		module: 'todo',
		description:
			'Listet Tasks mit Titel, Faelligkeit und Prioritaet auf. Nutze diese, wenn der Nutzer fragt welche Tasks er hat oder eine Liste sehen will.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'filter',
				type: 'string',
				description: 'Welche Tasks zeigen',
				required: false,
				enum: ['open', 'completed', 'overdue', 'today', 'all'],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (default: 20)',
				required: false,
			},
		],
	},

	// ── Calendar ──────────────────────────────────────────────
	{
		name: 'create_event',
		module: 'calendar',
		description: 'Erstellt einen neuen Kalender-Termin',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'title', type: 'string', description: 'Titel des Termins', required: true },
			{
				name: 'startTime',
				type: 'string',
				description: 'Startzeit (ISO 8601)',
				required: true,
			},
			{ name: 'endTime', type: 'string', description: 'Endzeit (ISO 8601)', required: true },
			{ name: 'isAllDay', type: 'boolean', description: 'Ganztaegig', required: false },
			{ name: 'location', type: 'string', description: 'Ort', required: false },
			{ name: 'description', type: 'string', description: 'Beschreibung', required: false },
		],
	},
	{
		name: 'get_todays_events',
		module: 'calendar',
		description: 'Gibt alle Termine fuer heute zurueck',
		defaultPolicy: 'auto',
		parameters: [],
	},

	// ── Notes ─────────────────────────────────────────────────
	{
		name: 'create_note',
		module: 'notes',
		description: 'Erstellt eine neue Notiz. Gibt die ID der angelegten Notiz zurueck.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'title', type: 'string', description: 'Titel der Notiz', required: false },
			{
				name: 'content',
				type: 'string',
				description: 'Inhalt der Notiz (Markdown)',
				required: true,
			},
		],
	},
	{
		name: 'update_note',
		module: 'notes',
		description:
			'Überschreibt Titel und/oder Inhalt einer bestehenden Notiz. Destruktiv — bevorzuge append_to_note oder add_tag_to_note wenn du nur ergänzen willst.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'noteId', type: 'string', description: 'ID der Notiz', required: true },
			{ name: 'title', type: 'string', description: 'Neuer Titel', required: false },
			{
				name: 'content',
				type: 'string',
				description: 'Neuer Inhalt (überschreibt vollständig)',
				required: false,
			},
		],
	},
	{
		name: 'append_to_note',
		module: 'notes',
		description:
			'Hängt Text ans Ende des Inhalts einer bestehenden Notiz an (neue Zeile getrennt). Nicht-destruktiv.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'noteId', type: 'string', description: 'ID der Notiz', required: true },
			{ name: 'content', type: 'string', description: 'Text zum Anhängen', required: true },
		],
	},
	{
		name: 'add_tag_to_note',
		module: 'notes',
		description:
			'Fügt einen Hashtag (z.B. "#Natur") an eine bestehende Notiz an. Idempotent — wenn der Tag schon vorhanden ist, passiert nichts.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'noteId', type: 'string', description: 'ID der Notiz', required: true },
			{
				name: 'tag',
				type: 'string',
				description:
					'Tag-Name (ohne #; z.B. "Natur", "Arbeit"). Leerzeichen werden durch _ ersetzt.',
				required: true,
			},
		],
	},
	{
		name: 'list_notes',
		module: 'notes',
		description:
			'Listet vorhandene Notizen (id, title, excerpt) damit du sie referenzieren kannst. Standardmäßig ohne archivierte.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 30, max 100)',
				required: false,
			},
			{
				name: 'query',
				type: 'string',
				description: 'Case-insensitive Substring-Filter auf Titel oder Inhalt',
				required: false,
			},
			{
				name: 'includeArchived',
				type: 'boolean',
				description: 'Auch archivierte Notizen einbeziehen (default false)',
				required: false,
			},
		],
	},

	// ── Places ────────────────────────────────────────────────
	{
		name: 'create_place',
		module: 'places',
		description: 'Erstellt einen neuen Ort',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'name', type: 'string', description: 'Name des Ortes', required: true },
			{ name: 'latitude', type: 'number', description: 'Breitengrad', required: true },
			{ name: 'longitude', type: 'number', description: 'Laengengrad', required: true },
			{
				name: 'category',
				type: 'string',
				description: 'Kategorie',
				required: false,
				enum: [
					'home',
					'work',
					'shopping',
					'sport',
					'culture',
					'nature',
					'transport',
					'health',
					'education',
					'nightlife',
					'other',
				],
			},
			{ name: 'address', type: 'string', description: 'Adresse', required: false },
		],
	},
	{
		name: 'visit_place',
		module: 'places',
		description: 'Vermerkt einen Besuch an einem bereits erfassten Ort',
		defaultPolicy: 'propose',
		parameters: [{ name: 'placeId', type: 'string', description: 'ID des Ortes', required: true }],
	},
	{
		name: 'get_places',
		module: 'places',
		description: 'Gibt alle gespeicherten Orte zurueck',
		defaultPolicy: 'auto',
		parameters: [],
	},
	{
		name: 'get_current_location',
		module: 'places',
		description: 'Gibt die aktuelle GPS-Position zurueck (erfordert Standort-Berechtigung)',
		defaultPolicy: 'auto',
		parameters: [],
	},

	// ── Drink ─────────────────────────────────────────────────
	{
		name: 'undo_drink',
		module: 'drink',
		description: 'Macht den letzten Drink-Eintrag rückgängig',
		defaultPolicy: 'propose',
		parameters: [],
	},
	{
		name: 'get_drink_progress',
		module: 'drink',
		description: 'Gibt den heutigen Trink-Fortschritt zurueck (Wasser, Kaffee, gesamt)',
		defaultPolicy: 'auto',
		parameters: [],
	},
	{
		name: 'log_drink',
		module: 'drink',
		description: 'Loggt ein Getraenk (Wasser, Kaffee, Tee, etc.)',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'drinkType',
				type: 'string',
				description: 'Art des Getraenks',
				required: true,
				enum: ['water', 'coffee', 'tea', 'juice', 'alcohol', 'smoothie', 'soda', 'other'],
			},
			{
				name: 'quantityMl',
				type: 'number',
				description: 'Menge in Milliliter',
				required: true,
			},
			{
				name: 'name',
				type: 'string',
				description: 'Name (z.B. "Latte Macchiato")',
				required: false,
			},
		],
	},

	// ── Articles (Pocket-style read-it-later) ───────────────
	{
		name: 'list_articles',
		module: 'articles',
		description:
			'Listet gespeicherte Artikel (id, title, siteName, status, readingTime). Optional nach Status filtern.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'status',
				type: 'string',
				description:
					'Nur Artikel mit diesem Status. Default: ohne Filter (archivierte werden nur bei "archived"/"all" eingeschlossen).',
				required: false,
				enum: ['unread', 'reading', 'finished', 'archived', 'all'],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 30, max 100)',
				required: false,
			},
			{
				name: 'query',
				type: 'string',
				description: 'Case-insensitive Substring-Filter auf Titel / Autor / Quelle',
				required: false,
			},
		],
	},
	{
		name: 'save_article',
		module: 'articles',
		description:
			'Speichert einen Artikel von einer URL in die Leseliste. URL wird serverseitig per Readability extrahiert.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'url', type: 'string', description: 'Die Artikel-URL', required: true },
			{
				name: 'title',
				type: 'string',
				description: 'Anzeigetitel für den Approval-Dialog (informativ)',
				required: false,
			},
			{
				name: 'reason',
				type: 'string',
				description: 'Kurze Begründung warum der Artikel für den Nutzer relevant ist',
				required: false,
			},
		],
	},
	{
		name: 'import_articles_from_urls',
		module: 'articles',
		description:
			'Erstellt einen Bulk-Import-Job für mehrere URLs. Server extrahiert sie nacheinander im Hintergrund (Concurrency 3, Retries pro URL). Auto-Policy: kein Approval pro Artikel, der Job wird als ein einziger Task angelegt. Returns die jobId zum Tracking.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'urls',
				type: 'array',
				description: 'Liste der Artikel-URLs (max 50)',
				required: true,
			},
		],
	},
	{
		name: 'archive_article',
		module: 'articles',
		description: 'Verschiebt einen Artikel ins Archiv.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'articleId',
				type: 'string',
				description: 'ID des Artikels (aus list_articles)',
				required: true,
			},
		],
	},
	{
		name: 'tag_article',
		module: 'articles',
		description:
			'Vergibt einen Tag auf einen Artikel. Tag wird angelegt falls er noch nicht existiert.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'articleId',
				type: 'string',
				description: 'ID des Artikels (aus list_articles)',
				required: true,
			},
			{
				name: 'tagName',
				type: 'string',
				description: 'Tag-Name (z.B. "KI", "lesen bald")',
				required: true,
			},
		],
	},
	{
		name: 'add_article_highlight',
		module: 'articles',
		description:
			'Markiert eine Textstelle in einem Artikel als Highlight. Der Text muss wörtlich im Artikel vorkommen — sonst wird der Call abgelehnt.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'articleId',
				type: 'string',
				description: 'ID des Artikels (aus list_articles)',
				required: true,
			},
			{
				name: 'text',
				type: 'string',
				description: 'Wörtliche Textstelle die markiert werden soll (10–500 Zeichen)',
				required: true,
			},
			{
				name: 'color',
				type: 'string',
				description: 'Highlight-Farbe',
				required: false,
				enum: ['yellow', 'green', 'blue', 'pink'],
			},
			{
				name: 'note',
				type: 'string',
				description: 'Optionale Notiz zum Highlight',
				required: false,
			},
		],
	},

	// ── News-Research ─────────────────────────────────────────
	{
		name: 'research_news',
		module: 'news-research',
		description:
			'Durchsucht RSS-Feeds und Web-Quellen nach relevanten Artikeln zu einem Thema. Gibt gefundene Artikel-URLs + Titel + Zusammenfassung zurueck. Nuetzlich als Vorstufe zu save_news_article.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'query',
				type: 'string',
				description: 'Suchbegriff / Thema (z.B. "TypeScript 5.8 release")',
				required: true,
			},
			{
				name: 'language',
				type: 'string',
				description: 'Sprache (z.B. "de" oder "en")',
				required: false,
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Max. Anzahl Ergebnisse (Standard: 10)',
				required: false,
			},
		],
	},

	// ── Journal ───────────────────────────────────────────────
	{
		name: 'create_journal_entry',
		module: 'journal',
		description:
			'Erstellt einen neuen Journal-Eintrag mit optionaler Stimmung (dankbar, glücklich, zufrieden, neutral, nachdenklich, traurig, gestresst, wütend)',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'content',
				type: 'string',
				description: 'Inhalt des Eintrags',
				required: true,
			},
			{ name: 'title', type: 'string', description: 'Optionaler Titel', required: false },
			{
				name: 'mood',
				type: 'string',
				description: 'Stimmung',
				required: false,
				enum: [
					'dankbar',
					'glücklich',
					'zufrieden',
					'neutral',
					'nachdenklich',
					'traurig',
					'gestresst',
					'wütend',
				],
			},
		],
	},

	// ── Habits ────────────────────────────────────────────────
	{
		name: 'create_habit',
		module: 'habits',
		description: 'Erstellt einen neuen Habit-Tracker. Gibt die ID des neuen Habits zurueck.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'title', type: 'string', description: 'Titel des Habits', required: true },
			{ name: 'icon', type: 'string', description: 'Emoji-Icon', required: true },
			{
				name: 'color',
				type: 'string',
				description: 'Hex-Farbe (z.B. #EF4444)',
				required: true,
			},
		],
	},
	{
		name: 'log_habit',
		module: 'habits',
		description:
			'Loggt eine Ausfuehrung eines existierenden Habits fuer heute. Optional mit Notiz.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'habitId', type: 'string', description: 'ID des Habits', required: true },
			{
				name: 'note',
				type: 'string',
				description: 'Optionale Notiz zum Log',
				required: false,
			},
		],
	},
	{
		name: 'get_habits',
		module: 'habits',
		description: 'Gibt alle aktiven Habits zurueck',
		defaultPolicy: 'auto',
		parameters: [],
	},

	// ── MyDay ─────────────────────────────────────────────────
	{
		name: 'get_myday_summary',
		module: 'myday',
		description:
			'Gibt eine komplette Tageszusammenfassung zurueck: Tasks, Termine, Trinken, Ernaehrung, Orte, Streaks und aktive Ziele. Nutze dieses Tool zuerst, um den vollen Tageskontext zu bekommen.',
		defaultPolicy: 'auto',
		parameters: [],
	},

	// ── Goals ─────────────────────────────────────────────────
	{
		name: 'list_goals',
		module: 'goals',
		description:
			'Listet alle Ziele mit aktuellem Fortschritt auf. Zeigt Titel, Fortschritt, Zielwert, Zeitraum und Status.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'filter',
				type: 'string',
				description: 'Welche Ziele zeigen',
				required: false,
				enum: ['active', 'paused', 'completed', 'all'],
			},
		],
	},
	{
		name: 'get_goal_progress',
		module: 'goals',
		description:
			'Gibt den detaillierten Fortschritt eines einzelnen Ziels zurueck, inklusive Metrik-Details und Periodeninfo.',
		defaultPolicy: 'auto',
		parameters: [{ name: 'goalId', type: 'string', description: 'ID des Ziels', required: true }],
	},
	{
		name: 'create_goal',
		module: 'goals',
		description:
			'Erstellt ein neues Ziel. Kann entweder ein Template verwenden (templateId) oder ein benutzerdefiniertes Ziel erstellen. Verfuegbare Templates: tpl-water-daily, tpl-tasks-daily, tpl-meals-daily, tpl-calories-daily, tpl-places-weekly, tpl-coffee-limit.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'templateId',
				type: 'string',
				description:
					'ID eines Templates (z.B. "tpl-water-daily"). Wenn gesetzt, werden andere Felder ignoriert.',
				required: false,
			},
			{
				name: 'title',
				type: 'string',
				description: 'Titel des Ziels (nur fuer benutzerdefinierte Ziele)',
				required: false,
			},
			{
				name: 'description',
				type: 'string',
				description: 'Beschreibung',
				required: false,
			},
			{
				name: 'targetValue',
				type: 'number',
				description: 'Zielwert (z.B. 8 fuer "8 Glaeser Wasser")',
				required: false,
			},
			{
				name: 'period',
				type: 'string',
				description: 'Zeitraum',
				required: false,
				enum: ['day', 'week', 'month'],
			},
			{
				name: 'comparison',
				type: 'string',
				description: 'Vergleich: gte = mindestens, lte = hoechstens',
				required: false,
				enum: ['gte', 'lte'],
			},
			{
				name: 'eventType',
				type: 'string',
				description:
					'Domain-Event zum Zaehlen (z.B. "DrinkLogged", "TaskCompleted", "WorkoutFinished")',
				required: false,
			},
			{
				name: 'moduleId',
				type: 'string',
				description: 'Zugehoeriges Modul (z.B. "drink", "todo", "body")',
				required: false,
			},
		],
	},
	{
		name: 'pause_goal',
		module: 'goals',
		description: 'Pausiert ein aktives Ziel. Kann spaeter wieder fortgesetzt werden.',
		defaultPolicy: 'propose',
		parameters: [{ name: 'goalId', type: 'string', description: 'ID des Ziels', required: true }],
	},
	{
		name: 'resume_goal',
		module: 'goals',
		description: 'Setzt ein pausiertes Ziel fort.',
		defaultPolicy: 'propose',
		parameters: [{ name: 'goalId', type: 'string', description: 'ID des Ziels', required: true }],
	},
	{
		name: 'complete_goal',
		module: 'goals',
		description: 'Markiert ein Ziel als abgeschlossen.',
		defaultPolicy: 'propose',
		parameters: [{ name: 'goalId', type: 'string', description: 'ID des Ziels', required: true }],
	},

	// ── Contacts ──────────────────────────────────────────────
	{
		name: 'create_contact',
		module: 'contacts',
		description: 'Erstellt einen neuen Kontakt. Felder die nicht bekannt sind einfach weglassen.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'firstName', type: 'string', description: 'Vorname', required: true },
			{ name: 'lastName', type: 'string', description: 'Nachname', required: false },
			{ name: 'email', type: 'string', description: 'E-Mail-Adresse', required: false },
			{ name: 'phone', type: 'string', description: 'Telefonnummer', required: false },
			{
				name: 'company',
				type: 'string',
				description: 'Firma / Organisation',
				required: false,
			},
			{
				name: 'notes',
				type: 'string',
				description: 'Freitext-Notizen zum Kontakt',
				required: false,
			},
		],
	},
	{
		name: 'get_contacts',
		module: 'contacts',
		description: 'Gibt alle Kontakte zurueck',
		defaultPolicy: 'auto',
		parameters: [],
	},

	// ── Mood ──────────────────────────────────────────────────
	{
		name: 'log_mood',
		module: 'mood',
		description:
			'Erfasst einen Mood-Check-in mit Level (1-10), primaerer Emotion und optionalem Kontext.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'level',
				type: 'number',
				description: 'Stimmungs-Level von 1 (schlecht) bis 10 (super)',
				required: true,
			},
			{
				name: 'emotion',
				type: 'string',
				description: 'Primaere Emotion',
				required: true,
				enum: [
					'happy',
					'calm',
					'energized',
					'grateful',
					'excited',
					'loved',
					'hopeful',
					'neutral',
					'bored',
					'tired',
					'sad',
					'anxious',
					'angry',
					'stressed',
					'frustrated',
					'overwhelmed',
				],
			},
			{
				name: 'activity',
				type: 'string',
				description: 'Was machst du gerade?',
				required: false,
				enum: [
					'work',
					'exercise',
					'social',
					'alone',
					'commute',
					'eating',
					'resting',
					'creative',
					'outdoors',
					'screen',
					'chores',
					'other',
				],
			},
			{
				name: 'notes',
				type: 'string',
				description: 'Optionale Notiz zum Check-in',
				required: false,
			},
		],
	},
	{
		name: 'get_mood_today',
		module: 'mood',
		description: 'Gibt alle heutigen Mood-Eintraege zurueck mit Durchschnitts-Level und Emotionen.',
		defaultPolicy: 'auto',
		parameters: [],
	},
	{
		name: 'get_mood_insights',
		module: 'mood',
		description:
			'Gibt Mood-Trends und Muster zurueck: Durchschnitt der letzten 7/30 Tage, haeufigste Emotion, Positiv/Negativ-Verhaeltnis, und welche Aktivitaeten mit guter/schlechter Stimmung korrelieren.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'days',
				type: 'number',
				description: 'Analyse-Zeitraum in Tagen (Standard: 7)',
				required: false,
			},
		],
	},

	// ── Finance ───────────────────────────────────────────────
	{
		name: 'add_transaction',
		module: 'finance',
		description: 'Erfasst eine Einnahme oder Ausgabe',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'type',
				type: 'string',
				description: 'Art',
				required: true,
				enum: ['income', 'expense'],
			},
			{ name: 'amount', type: 'number', description: 'Betrag in Euro', required: true },
			{ name: 'description', type: 'string', description: 'Beschreibung', required: true },
			{
				name: 'date',
				type: 'string',
				description: 'Datum (YYYY-MM-DD, Standard: heute)',
				required: false,
			},
		],
	},
	{
		name: 'get_month_summary',
		module: 'finance',
		description:
			'Gibt die Finanz-Zusammenfassung fuer einen Monat zurueck: Einnahmen, Ausgaben, Bilanz, Ausgaben pro Kategorie.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'month',
				type: 'string',
				description: 'Monat im Format YYYY-MM (Standard: aktueller Monat)',
				required: false,
			},
		],
	},
	{
		name: 'list_transactions',
		module: 'finance',
		description:
			'Listet die letzten Transaktionen auf. Optional nach Typ (income/expense) und Monat filterbar.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'type',
				type: 'string',
				description: 'Nur income oder expense zeigen',
				required: false,
				enum: ['income', 'expense'],
			},
			{
				name: 'month',
				type: 'string',
				description: 'Monat im Format YYYY-MM',
				required: false,
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard: 20)',
				required: false,
			},
		],
	},

	// ── Times ─────────────────────────────────────────────────
	{
		name: 'start_timer',
		module: 'times',
		description: 'Startet einen Zeitmess-Timer mit optionaler Beschreibung und Projekt.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'description',
				type: 'string',
				description: 'Beschreibung der Taetigkeit',
				required: false,
			},
			{
				name: 'projectId',
				type: 'string',
				description: 'ID eines Projekts (aus list_projects)',
				required: false,
			},
		],
	},
	{
		name: 'stop_timer',
		module: 'times',
		description: 'Stoppt den laufenden Timer und speichert den Zeiteintrag.',
		defaultPolicy: 'propose',
		parameters: [],
	},
	{
		name: 'get_timer_status',
		module: 'times',
		description: 'Gibt den Status des laufenden Timers zurueck (ob aktiv, Dauer, Beschreibung).',
		defaultPolicy: 'auto',
		parameters: [],
	},
	{
		name: 'get_time_stats',
		module: 'times',
		description:
			'Gibt Zeiterfassungs-Statistiken zurueck: Stunden heute, diese Woche, und Aufschluesselung nach Projekt.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'period',
				type: 'string',
				description: 'Zeitraum (Standard: week)',
				required: false,
				enum: ['today', 'week', 'month'],
			},
		],
	},
	{
		name: 'list_projects',
		module: 'times',
		description: 'Listet alle aktiven Zeiterfassungs-Projekte mit Kunden-Info auf.',
		defaultPolicy: 'auto',
		parameters: [],
	},

	// ── Wetter ───────────────────────────────────────────────────
	{
		name: 'get_weather',
		module: 'wetter',
		description:
			'Gibt aktuelle Wetterbedingungen und 7-Tage-Vorhersage fuer einen Ort zurueck. Akzeptiert Ortsname oder Koordinaten.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'location',
				type: 'string',
				description: 'Ortsname (z.B. "Berlin") oder "lat,lon" Koordinaten',
				required: true,
			},
		],
	},
	{
		name: 'get_rain_forecast',
		module: 'wetter',
		description:
			'Gibt eine Minuten-Regenprognose (Nowcast) und aktive Wetterwarnungen fuer einen Ort zurueck.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'location',
				type: 'string',
				description: 'Ortsname oder "lat,lon" Koordinaten',
				required: true,
			},
		],
	},

	// ── Event Discovery ─────────────────────────────────────────
	{
		name: 'discover_events',
		module: 'events',
		description:
			'Sucht oeffentliche Veranstaltungen in den konfigurierten Regionen des Nutzers. Gibt Events mit Titel, Datum, Ort, Kategorie und Quelle zurueck.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'query',
				type: 'string',
				description: 'Optionaler Suchtext (z.B. "Jazz Konzerte")',
				required: false,
			},
			{
				name: 'category',
				type: 'string',
				description: 'Kategorie-Filter',
				required: false,
				enum: [
					'music',
					'theater',
					'art',
					'tech',
					'sport',
					'family',
					'nature',
					'education',
					'community',
					'nightlife',
					'market',
					'other',
				],
			},
			{
				name: 'days_ahead',
				type: 'number',
				description: 'Wie viele Tage voraus suchen (Standard: 14)',
				required: false,
			},
		],
	},
	{
		name: 'suggest_event',
		module: 'events',
		description:
			'Schlaegt dem Nutzer ein entdecktes Event vor. Erstellt ein Proposal das der Nutzer bestaetigen muss, um das Event in seinen Kalender zu uebernehmen.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'discovered_event_id',
				type: 'string',
				description: 'ID des entdeckten Events',
				required: true,
			},
			{
				name: 'reason',
				type: 'string',
				description: 'Begruendung warum dieses Event relevant ist',
				required: false,
			},
		],
	},

	// ── Quiz ──────────────────────────────────────────────────
	{
		name: 'create_quiz',
		module: 'quiz',
		description: 'Erstellt ein neues leeres Quiz mit Titel und optionaler Kategorie',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'title', type: 'string', description: 'Titel des Quiz', required: true },
			{
				name: 'description',
				type: 'string',
				description: 'Optionale Beschreibung',
				required: false,
			},
			{
				name: 'category',
				type: 'string',
				description: 'Optionale Kategorie (z.B. "Geografie")',
				required: false,
			},
		],
	},
	{
		name: 'update_quiz',
		module: 'quiz',
		description:
			'Aktualisiert Metadaten eines bestehenden Quiz. Nur die mitgegebenen Felder werden geschrieben. Leerstring bei description/category loescht den Wert',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'quizId', type: 'string', description: 'ID des Quiz', required: true },
			{ name: 'title', type: 'string', description: 'Neuer Titel', required: false },
			{ name: 'description', type: 'string', description: 'Neue Beschreibung', required: false },
			{ name: 'category', type: 'string', description: 'Neue Kategorie', required: false },
			{
				name: 'isPinned',
				type: 'boolean',
				description: 'Quiz oben anpinnen',
				required: false,
			},
			{
				name: 'isArchived',
				type: 'boolean',
				description: 'Quiz archivieren (aus Liste ausblenden)',
				required: false,
			},
		],
	},
	{
		name: 'add_quiz_question',
		module: 'quiz',
		description:
			'Fuegt einem bestehenden Quiz eine Frage hinzu. optionsJson-Format ist abhaengig vom type: single/multi => JSON-Array [{"text":"...","correct":true|false}] mit mindestens zwei Eintraegen und mindestens einem correct:true; truefalse => "true" oder "false" als korrekte Antwort; text => die erwartete Antwort als Klartext (Case-insensitive verglichen)',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'quizId', type: 'string', description: 'ID des Quiz', required: true },
			{
				name: 'type',
				type: 'string',
				description: 'Fragetyp',
				required: true,
				enum: ['single', 'multi', 'truefalse', 'text'],
			},
			{ name: 'questionText', type: 'string', description: 'Die Fragestellung', required: true },
			{
				name: 'optionsJson',
				type: 'string',
				description: 'Antwortdaten — Format abhaengig von type (siehe Tool-Beschreibung)',
				required: true,
			},
			{
				name: 'explanation',
				type: 'string',
				description: 'Optionale Erklaerung, die nach dem Beantworten angezeigt wird',
				required: false,
			},
		],
	},
	{
		name: 'update_quiz_question',
		module: 'quiz',
		description:
			'Aktualisiert eine vorhandene Frage. Beim Aendern der Antworten muessen type + optionsJson zusammen uebergeben werden (gleiches Format wie bei add_quiz_question). Text und Erklaerung koennen unabhaengig geaendert werden',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'questionId', type: 'string', description: 'ID der Frage', required: true },
			{
				name: 'questionText',
				type: 'string',
				description: 'Neue Fragestellung',
				required: false,
			},
			{
				name: 'type',
				type: 'string',
				description: 'Neuer Fragetyp (wenn optionsJson mitgegeben wird)',
				required: false,
				enum: ['single', 'multi', 'truefalse', 'text'],
			},
			{
				name: 'optionsJson',
				type: 'string',
				description: 'Neue Antwortdaten — Format abhaengig vom type',
				required: false,
			},
			{
				name: 'explanation',
				type: 'string',
				description: 'Neue Erklaerung (Leerstring loescht)',
				required: false,
			},
		],
	},
	{
		name: 'delete_quiz_question',
		module: 'quiz',
		description: 'Loescht eine Frage aus einem Quiz',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'questionId', type: 'string', description: 'ID der Frage', required: true },
		],
	},
	{
		name: 'list_quizzes',
		module: 'quiz',
		description:
			'Listet vorhandene Quizze (id, title, category, questionCount) damit du sie referenzieren kannst',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 30, max 100)',
				required: false,
			},
			{
				name: 'query',
				type: 'string',
				description: 'Case-insensitive Substring-Filter auf Titel oder Kategorie',
				required: false,
			},
		],
	},
	{
		name: 'get_quiz_questions',
		module: 'quiz',
		description:
			'Liest alle Fragen eines Quiz (id, order, type, questionText, options, explanation). Nutze dies bevor du weitere Fragen ergaenzt, um Duplikate zu vermeiden',
		defaultPolicy: 'auto',
		parameters: [{ name: 'quizId', type: 'string', description: 'ID des Quiz', required: true }],
	},
	{
		name: 'get_quiz_stats',
		module: 'quiz',
		description:
			'Gibt Statistiken zu einem Quiz zurueck: Anzahl der Versuche, Durchschnitts-Score, bester Score, letzter Versuch. Nuetzlich fuer adaptive Missionen (Schwachstellen erkennen)',
		defaultPolicy: 'auto',
		parameters: [{ name: 'quizId', type: 'string', description: 'ID des Quiz', required: true }],
	},

	// ── Invoices ─────────────────────────────────────────────
	{
		name: 'create_invoice',
		module: 'invoices',
		description:
			'Erstellt eine neue Rechnung als Entwurf. Setzt Kunde (Name + optional Adresse + E-Mail), Positionen (Titel, Menge, Einzelpreis in Hauptwaehrung), Faelligkeit. Nummer wird automatisch vergeben.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'clientName',
				type: 'string',
				description: 'Name des Kunden (erforderlich)',
				required: true,
			},
			{
				name: 'clientEmail',
				type: 'string',
				description: 'E-Mail-Adresse des Kunden',
				required: false,
			},
			{
				name: 'clientAddress',
				type: 'string',
				description: 'Postanschrift des Kunden (mehrzeilig, Strasse + Nr, dann PLZ Ort)',
				required: false,
			},
			{
				name: 'subject',
				type: 'string',
				description: 'Kurzer Betreff (z.B. "Beratung April")',
				required: false,
			},
			{
				name: 'currency',
				type: 'string',
				description: 'Waehrung (Standard: CHF)',
				required: false,
				enum: ['CHF', 'EUR', 'USD'],
			},
			{
				name: 'dueDate',
				type: 'string',
				description: 'Faelligkeitsdatum (YYYY-MM-DD). Ohne Angabe: +30 Tage ab heute.',
				required: false,
			},
			{
				name: 'lines',
				type: 'array',
				description:
					'Array von Positionen: [{ title: string, quantity: number, unitPrice: number (in Hauptwaehrung, z.B. 150.00), vatRate?: number, unit?: string }]. Mindestens eine Position.',
				required: true,
			},
		],
	},
	{
		name: 'mark_invoice_paid',
		module: 'invoices',
		description:
			'Markiert eine versendete oder ueberfaellige Rechnung als bezahlt. paidAt ist optional (Standard: heute, fuer rueckdatierte Eingaenge ein fruehes Datum setzen).',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'invoiceId',
				type: 'string',
				description: 'ID der Rechnung (aus list_invoices)',
				required: true,
			},
			{
				name: 'paidAt',
				type: 'string',
				description: 'Zahlungsdatum (ISO oder YYYY-MM-DD). Standard: jetzt.',
				required: false,
			},
		],
	},
	{
		name: 'list_invoices',
		module: 'invoices',
		description:
			'Listet Rechnungen auf. Optional nach Status (draft/sent/paid/overdue/void) und Limit gefiltert. Gibt ID, Nummer, Kunde, Status, Betrag, Faelligkeit zurueck.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'status',
				type: 'string',
				description: 'Nur diesen Status zeigen',
				required: false,
				enum: ['draft', 'sent', 'paid', 'overdue', 'void'],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard: 20)',
				required: false,
			},
		],
	},
	{
		name: 'get_invoice_stats',
		module: 'invoices',
		description:
			'Gibt Rechnungs-Kennzahlen zurueck: offene Summe, ueberfaellige Summe, YTD fakturiert + bezahlt (pro Waehrung, in Hauptwaehrung als Gleitkomma).',
		defaultPolicy: 'auto',
		parameters: [],
	},

	// ── Library ───────────────────────────────────────────────
	{
		name: 'create_library_entry',
		module: 'library',
		description:
			'Erstellt einen neuen Eintrag in der Bibliothek (Buch, Film, Serie oder Comic). Default-Status ist "planned" falls nicht anders angegeben.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'kind',
				type: 'string',
				description: 'Art des Eintrags',
				required: true,
				enum: ['book', 'movie', 'series', 'comic'],
			},
			{ name: 'title', type: 'string', description: 'Titel', required: true },
			{
				name: 'creators',
				type: 'string',
				description: 'Autor/Regisseur/Creator, mehrere durch Komma trennen',
				required: false,
			},
			{ name: 'year', type: 'number', description: 'Erscheinungsjahr', required: false },
			{
				name: 'status',
				type: 'string',
				description: 'Anfangsstatus',
				required: false,
				enum: ['planned', 'active', 'completed', 'paused', 'dropped'],
			},
			{
				name: 'rating',
				type: 'number',
				description: 'Bewertung 1-5 (nur bei completed sinnvoll)',
				required: false,
			},
			{
				name: 'tags',
				type: 'string',
				description: 'Tags durch Komma getrennt',
				required: false,
			},
			{
				name: 'genres',
				type: 'string',
				description: 'Genres durch Komma getrennt',
				required: false,
			},
		],
	},
	{
		name: 'update_library_entry_status',
		module: 'library',
		description:
			'Aendert den Status eines Bibliotheks-Eintrags (planned/active/completed/paused/dropped). Setzt beim Wechsel auf "active" automatisch startedAt, bei "completed" completedAt.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'entryId', type: 'string', description: 'ID des Eintrags', required: true },
			{
				name: 'status',
				type: 'string',
				description: 'Neuer Status',
				required: true,
				enum: ['planned', 'active', 'completed', 'paused', 'dropped'],
			},
		],
	},
	{
		name: 'rate_library_entry',
		module: 'library',
		description: 'Setzt die Bewertung (1-5) eines Bibliotheks-Eintrags.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'entryId', type: 'string', description: 'ID des Eintrags', required: true },
			{ name: 'rating', type: 'number', description: 'Bewertung 1 bis 5', required: true },
		],
	},
	{
		name: 'list_library_entries',
		module: 'library',
		description:
			'Listet Bibliotheks-Eintraege (id, kind, title, status, rating). Optional nach Art und Status filterbar.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'kind',
				type: 'string',
				description: 'Nur eine Art zeigen',
				required: false,
				enum: ['book', 'movie', 'series', 'comic'],
			},
			{
				name: 'status',
				type: 'string',
				description: 'Nur einen Status zeigen',
				required: false,
				enum: ['planned', 'active', 'completed', 'paused', 'dropped'],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 30)',
				required: false,
			},
		],
	},

	// ── Broadcast (Newsletter) ───────────────────────────────
	{
		name: 'create_campaign_draft',
		module: 'broadcast',
		description:
			'Erstellt einen Newsletter-/Kampagnen-Entwurf mit Name, Betreff, optionalem Preheader und fertigem HTML-Body. Empfaengerliste bleibt leer — der Nutzer waehlt sie in der UI. Gibt die ID zurueck.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'name',
				type: 'string',
				description: 'Interner Arbeitstitel der Kampagne',
				required: true,
			},
			{
				name: 'subject',
				type: 'string',
				description: 'E-Mail-Betreff (was im Posteingang steht)',
				required: true,
			},
			{
				name: 'preheader',
				type: 'string',
				description: 'Vorschau-Text neben dem Betreff in Gmail',
				required: false,
			},
			{
				name: 'htmlContent',
				type: 'string',
				description:
					'Body als HTML. Erlaubte Tags: p, h1, h2, h3, ul, ol, li, a, strong, em, br. Links verwenden href="https://…".',
				required: true,
			},
		],
	},
	{
		name: 'list_campaigns',
		module: 'broadcast',
		description:
			'Listet Kampagnen (id, name, subject, status, Empfaengerzahl, sentAt) — optional nach Status gefiltert.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'status',
				type: 'string',
				description: 'Nur diesen Status zeigen',
				required: false,
				enum: ['draft', 'scheduled', 'sending', 'sent', 'cancelled'],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 20)',
				required: false,
			},
		],
	},
	{
		name: 'get_campaign_stats',
		module: 'broadcast',
		description:
			'Gibt Kennzahlen zu einer Kampagne zurueck: Oeffnungsrate, Klickrate, Bounce-Rate, Abmelderate (jeweils 0..1).',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'campaignId',
				type: 'string',
				description: 'ID der Kampagne (aus list_campaigns)',
				required: true,
			},
		],
	},

	// ── Website ───────────────────────────────────────────────
	{
		name: 'create_website',
		module: 'website',
		description:
			'Erstellt eine neue Website im aktiven Space mit einer Startseite. Gibt siteId und homePageId zurueck.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'name',
				type: 'string',
				description: 'Anzeigename der Website',
				required: true,
			},
			{
				name: 'slug',
				type: 'string',
				description: '2-40 Kleinbuchstaben/Zahlen/Bindestrich — wird Teil der URL (/s/{slug})',
				required: true,
			},
		],
	},
	{
		name: 'apply_website_template',
		module: 'website',
		description:
			'Erstellt eine neue Website aus einem Template (portfolio, personal-linktree, event, blank). Kopiert alle Seiten und Bloecke mit neuen IDs.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'templateId',
				type: 'string',
				description: 'Template-Kennung',
				required: true,
				enum: ['portfolio', 'personal-linktree', 'event', 'blank'],
			},
			{ name: 'name', type: 'string', description: 'Website-Name', required: true },
			{ name: 'slug', type: 'string', description: 'URL-Slug', required: true },
		],
	},
	{
		name: 'create_website_page',
		module: 'website',
		description:
			'Fuegt einer existierenden Website eine neue Seite hinzu (z.B. /ueber-uns, /kontakt).',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'siteId', type: 'string', description: 'ID der Website', required: true },
			{
				name: 'path',
				type: 'string',
				description: 'URL-Pfad mit fuehrendem Slash (z.B. /ueber-uns)',
				required: true,
			},
			{ name: 'title', type: 'string', description: 'Seitentitel', required: true },
		],
	},
	{
		name: 'add_website_block',
		module: 'website',
		description:
			'Fuegt einer Seite einen neuen Block hinzu. Block-Typen: hero, richText, cta, image, gallery, faq, form, moduleEmbed, columns, spacer. `props` ist ein JSON-Objekt mit den typ-spezifischen Feldern.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'pageId', type: 'string', description: 'ID der Zielseite', required: true },
			{
				name: 'type',
				type: 'string',
				description: 'Block-Typ',
				required: true,
				enum: [
					'hero',
					'richText',
					'cta',
					'image',
					'gallery',
					'faq',
					'form',
					'moduleEmbed',
					'columns',
					'spacer',
				],
			},
			{
				name: 'props',
				type: 'object',
				description:
					'Typ-spezifische Eigenschaften. Leer = verwendet die Defaults. Beispiel fuer hero: { title, subtitle, ctaLabel, ctaHref }.',
				required: false,
			},
			{
				name: 'parentBlockId',
				type: 'string',
				description:
					'Falls der Block in einem Container liegt (z.B. columns), die ID des Containers.',
				required: false,
			},
			{
				name: 'slotKey',
				type: 'string',
				description: 'Slot-Key innerhalb des Containers, z.B. col-0 / col-1.',
				required: false,
			},
		],
	},
	{
		name: 'update_website_block',
		module: 'website',
		description:
			'Aktualisiert die props eines Blocks. `patch` ist ein JSON-Objekt mit nur den zu aendernden Feldern — alles andere bleibt unveraendert.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'blockId', type: 'string', description: 'ID des Blocks', required: true },
			{
				name: 'patch',
				type: 'object',
				description: 'Die zu aendernden props-Felder',
				required: true,
			},
		],
	},
	{
		name: 'publish_website',
		module: 'website',
		description:
			'Veroeffentlicht die aktuelle Draft-Version der Website unter /s/{slug}. Vorher sollte der Inhalt vom Nutzer geprueft werden.',
		defaultPolicy: 'propose',
		parameters: [{ name: 'siteId', type: 'string', description: 'ID der Website', required: true }],
	},
	{
		name: 'list_websites',
		module: 'website',
		description:
			'Listet alle Websites im aktiven Space (id, slug, name, published-Status). Auto-Policy: laeuft waehrend Planning.',
		defaultPolicy: 'auto',
		parameters: [],
	},
	{
		name: 'list_website_pages',
		module: 'website',
		description: 'Listet die Seiten einer Website (id, path, title, order). Auto-Policy.',
		defaultPolicy: 'auto',
		parameters: [{ name: 'siteId', type: 'string', description: 'ID der Website', required: true }],
	},
	{
		name: 'list_website_blocks',
		module: 'website',
		description:
			'Listet die Bloecke einer Seite (id, type, parentBlockId, order, props-Snapshot). Auto-Policy.',
		defaultPolicy: 'auto',
		parameters: [{ name: 'pageId', type: 'string', description: 'ID der Seite', required: true }],
	},

	// ── Writing (Ghostwriter) ─────────────────────────────────
	{
		name: 'list_drafts',
		module: 'writing',
		description:
			'Listet Writing-Drafts (id, kind, title, status, wordCount). Optional nach kind oder status filterbar.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'kind',
				type: 'string',
				description: 'Nur eine Textart zeigen',
				required: false,
				enum: [
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
				],
			},
			{
				name: 'status',
				type: 'string',
				description: 'Nur einen Status zeigen',
				required: false,
				enum: ['draft', 'refining', 'complete', 'published'],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 30)',
				required: false,
			},
		],
	},
	{
		name: 'get_draft',
		module: 'writing',
		description:
			'Liefert einen vollstaendigen Draft inklusive Briefing, aktueller Version, Stil und Quellen.',
		defaultPolicy: 'auto',
		parameters: [{ name: 'draftId', type: 'string', description: 'ID des Drafts', required: true }],
	},
	{
		name: 'list_writing_styles',
		module: 'writing',
		description:
			'Listet verfuegbare Schreibstile (9 eingebaute Presets + vom Nutzer angelegte). Jeder mit id (preset:<id> oder uuid), name und Kurzbeschreibung.',
		defaultPolicy: 'auto',
		parameters: [],
	},
	{
		name: 'create_draft',
		module: 'writing',
		description:
			'Legt einen neuen Writing-Draft mit Briefing an — noch ohne Generation. Optional mit Stil und Quellen. Danach via generate_draft_content die erste Version erzeugen.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'kind',
				type: 'string',
				description: 'Textart',
				required: true,
				enum: [
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
				],
			},
			{ name: 'title', type: 'string', description: 'Titel / Arbeitstitel', required: true },
			{
				name: 'topic',
				type: 'string',
				description: 'Kern-Briefing (worum geht es?)',
				required: true,
			},
			{ name: 'audience', type: 'string', description: 'Zielgruppe', required: false },
			{
				name: 'tone',
				type: 'string',
				description: 'Ton (z.B. "neutral", "warm")',
				required: false,
			},
			{
				name: 'language',
				type: 'string',
				description: 'ISO-Sprachcode, Standard "de"',
				required: false,
			},
			{
				name: 'targetWords',
				type: 'number',
				description: 'Ziel-Laenge in Woertern',
				required: false,
			},
			{
				name: 'styleId',
				type: 'string',
				description: 'Stil-ID (preset:<id> oder uuid einer Custom-Style-Row)',
				required: false,
			},
			{
				name: 'extraInstructions',
				type: 'string',
				description: 'Zusatzhinweise fuer die Generation',
				required: false,
			},
		],
	},
	{
		name: 'generate_draft_content',
		module: 'writing',
		description:
			'Erzeugt Text fuer einen existierenden Draft. Schreibt eine neue LocalDraftVersion und flippt den currentVersionId-Pointer auf die neue Version. Nutzt Briefing + Stil + Quellen des Drafts.',
		defaultPolicy: 'propose',
		parameters: [{ name: 'draftId', type: 'string', description: 'ID des Drafts', required: true }],
	},
	{
		name: 'refine_draft_selection',
		module: 'writing',
		description:
			'Verfeinert einen markierten Ausschnitt der aktuellen Version in-place. Operationen: shorten, expand, tone (target), rewrite (instruction), translate (targetLanguage). Wird direkt auf die aktuelle Version angewandt — keine neue Version.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'draftId', type: 'string', description: 'ID des Drafts', required: true },
			{
				name: 'operation',
				type: 'string',
				description: 'Art der Verfeinerung',
				required: true,
				enum: ['shorten', 'expand', 'tone', 'rewrite', 'translate'],
			},
			{
				name: 'selectionStart',
				type: 'number',
				description: 'Zeichen-Start der Auswahl (0-basiert)',
				required: true,
			},
			{
				name: 'selectionEnd',
				type: 'number',
				description: 'Zeichen-Ende der Auswahl (exklusiv)',
				required: true,
			},
			{
				name: 'targetTone',
				type: 'string',
				description: 'Nur fuer operation=tone: der Zielton',
				required: false,
			},
			{
				name: 'instruction',
				type: 'string',
				description: 'Nur fuer operation=rewrite: die Anweisung',
				required: false,
			},
			{
				name: 'targetLanguage',
				type: 'string',
				description: 'Nur fuer operation=translate: ISO-Code der Zielsprache',
				required: false,
			},
		],
	},
	{
		name: 'set_draft_status',
		module: 'writing',
		description:
			'Setzt den Status eines Drafts (draft/refining/complete/published). Emittiert WritingDraftStatusChanged fuer die Timeline.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'draftId', type: 'string', description: 'ID des Drafts', required: true },
			{
				name: 'status',
				type: 'string',
				description: 'Neuer Status',
				required: true,
				enum: ['draft', 'refining', 'complete', 'published'],
			},
		],
	},
	{
		name: 'save_draft_as_article',
		module: 'writing',
		description:
			'Veroeffentlicht die aktuelle Version des Drafts als Read-Later-Artikel im articles-Modul. Traegt das Ziel in draft.publishedTo ein und emittiert WritingDraftPublished.',
		defaultPolicy: 'propose',
		parameters: [{ name: 'draftId', type: 'string', description: 'ID des Drafts', required: true }],
	},

	// ── Comic ───────────────────────────────────────────────
	{
		name: 'list_comic_stories',
		module: 'comic',
		description:
			'Listet Comic-Stories im aktiven Space (id, title, style, panelCount, isFavorite). Optional nach Stil oder Favoriten filterbar.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'style',
				type: 'string',
				description: 'Nur einen Stil zeigen',
				required: false,
				enum: ['comic', 'manga', 'cartoon', 'graphic-novel', 'webtoon'],
			},
			{
				name: 'favoriteOnly',
				type: 'boolean',
				description: 'Nur Favoriten',
				required: false,
			},
			{ name: 'limit', type: 'number', description: 'Max (Standard 30)', required: false },
		],
	},
	{
		name: 'create_comic_story',
		module: 'comic',
		description:
			'Legt eine neue Comic-Story an. Charakter-Referenzen werden automatisch aus den primary face-ref + body-ref des aktiven Space aufgeloest — Nutzer muss vorher ein Gesichtsbild in /profile/me-images hochgeladen haben. Stil ist fix, alle spaeteren Panels nutzen denselben Stil-Prefix.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'title', type: 'string', description: 'Titel der Story', required: true },
			{
				name: 'style',
				type: 'string',
				description: 'Visueller Stil',
				required: true,
				enum: ['comic', 'manga', 'cartoon', 'graphic-novel', 'webtoon'],
			},
			{
				name: 'description',
				type: 'string',
				description: 'Kurze Story-Beschreibung',
				required: false,
			},
			{
				name: 'storyContext',
				type: 'string',
				description:
					'Freitext-Briefing — Ton, Ziel, Hintergrund. Wird im AI-Storyboard-Flow als Briefing genutzt.',
				required: false,
			},
			{
				name: 'tags',
				type: 'string',
				description: 'Tags durch Komma getrennt',
				required: false,
			},
		],
	},
	{
		name: 'generate_comic_panel',
		module: 'comic',
		description:
			'Rendert ein neues Panel in einer bestehenden Story via gpt-image-2. Konsumiert Credits (low=3, medium=10, high=25). Stil-Prefix und Charakter-Refs kommen aus der Story — nur Panel-Prompt + optional Caption/Dialog werden uebergeben. Caption und Dialog werden direkt in das Bild gerendert.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'storyId', type: 'string', description: 'ID der Story', required: true },
			{
				name: 'panelPrompt',
				type: 'string',
				description:
					'Was passiert in diesem Panel (Szene, Aktion, Stimmung). Kurze englische Saetze am stabilsten.',
				required: true,
			},
			{
				name: 'caption',
				type: 'string',
				description: 'Erzaehl-Zeile ueber/unter dem Bild (optional)',
				required: false,
			},
			{
				name: 'dialogue',
				type: 'string',
				description: 'Sprechblasen-Text (optional)',
				required: false,
			},
			{
				name: 'quality',
				type: 'string',
				description: 'Render-Qualitaet — hoeher = mehr Credits',
				required: false,
				enum: ['low', 'medium', 'high'],
			},
			{
				name: 'model',
				type: 'string',
				description:
					'Rendering-Backend. openai/gpt-image-2 ist Standard. google/gemini-3-pro-image-preview = Nano Banana Pro (hoehere Charakter-Konsistenz, teurer). google/gemini-3.1-flash-image-preview = Nano Banana 2 (neuestes, schnell, guenstig).',
				required: false,
				enum: [
					'openai/gpt-image-2',
					'google/gemini-3-pro-image-preview',
					'google/gemini-3.1-flash-image-preview',
				],
			},
		],
	},
	{
		name: 'list_comic_characters',
		module: 'comic',
		description:
			'Listet Comic-Characters im aktiven Space (id, name, style, variantCount, pinnedVariantId, isFavorite). Optional nach Stil oder Favoriten filterbar.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'style',
				type: 'string',
				description: 'Nur einen Stil zeigen',
				required: false,
				enum: ['comic', 'manga', 'cartoon', 'graphic-novel', 'webtoon'],
			},
			{
				name: 'favoriteOnly',
				type: 'boolean',
				description: 'Nur Favoriten',
				required: false,
			},
			{ name: 'limit', type: 'number', description: 'Max (Standard 30)', required: false },
		],
	},
	{
		name: 'create_comic_character',
		module: 'comic',
		description:
			'Legt einen neuen Comic-Character an OHNE direkt Varianten zu rendern (Splittet Anlegen von Generierung — User reviewt erst). Charakter-Refs werden automatisch aus dem primary face-ref + body-ref des aktiven Space aufgeloest. Stil ist fix nach Anlage. Gibt characterId zurueck — danach generate_character_variant aufrufen.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'name', type: 'string', description: 'Name des Characters', required: true },
			{
				name: 'style',
				type: 'string',
				description: 'Visueller Stil',
				required: true,
				enum: ['comic', 'manga', 'cartoon', 'graphic-novel', 'webtoon'],
			},
			{
				name: 'addPrompt',
				type: 'string',
				description: 'Zusaetzlicher Prompt (z.B. "freundlicher Ausdruck", "casual outfit")',
				required: false,
			},
			{
				name: 'description',
				type: 'string',
				description: 'Kurze Charakter-Beschreibung',
				required: false,
			},
			{ name: 'tags', type: 'string', description: 'Tags durch Komma getrennt', required: false },
		],
	},
	{
		name: 'generate_character_variant',
		module: 'comic',
		description:
			'Rendert N (default 4) Variant-Portraits fuer einen existierenden Comic-Character und appended sie an den Variant-Pool. Konsumiert Credits × count (medium=10c). Auto-pinnt die erste Variante wenn noch keine gepinnt ist. Stil + Source-Refs kommen aus dem Character — nur count + quality + model sind hier waehlbar.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'characterId',
				type: 'string',
				description: 'ID des Characters',
				required: true,
			},
			{
				name: 'count',
				type: 'number',
				description: 'Anzahl Varianten (1-4, default 4)',
				required: false,
			},
			{
				name: 'quality',
				type: 'string',
				description: 'Render-Qualitaet — hoeher = mehr Credits',
				required: false,
				enum: ['low', 'medium', 'high'],
			},
			{
				name: 'model',
				type: 'string',
				description: 'Rendering-Backend (default openai/gpt-image-2).',
				required: false,
				enum: [
					'openai/gpt-image-2',
					'google/gemini-3-pro-image-preview',
					'google/gemini-3.1-flash-image-preview',
				],
			},
		],
	},
	{
		name: 'pin_character_variant',
		module: 'comic',
		description:
			'Setzt einen anderen Variant als kanonischen Look des Comic-Characters. Stories die DANACH erstellt werden nutzen den neuen Pin; bestehende Stories bleiben unveraendert (sie haben den alten Variant zum Story-Create-Zeitpunkt fix gespeichert).',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'characterId', type: 'string', description: 'ID des Characters', required: true },
			{
				name: 'variantMediaId',
				type: 'string',
				description: 'ID der Variante die zum neuen Pin werden soll (muss in variantMediaIds sein)',
				required: true,
			},
		],
	},

	// ── Augur (signs / fortunes / hunches) ──────────────────────
	{
		name: 'capture_sign',
		module: 'augur',
		description:
			'Erfasst ein Zeichen (Omen, Wahrsagung oder Bauchgefuehl) im Augur-Modul. Standardmaessig Stimmung "mysterious" wenn nicht angegeben. Gibt die ID zurueck.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'kind',
				type: 'string',
				description: 'Art des Zeichens',
				required: true,
				enum: ['omen', 'fortune', 'hunch'],
			},
			{
				name: 'source',
				type: 'string',
				description: 'Quelle (z.B. "schwarze Katze", "Glueckskeks", "Bauchgefuehl")',
				required: true,
			},
			{
				name: 'claim',
				type: 'string',
				description: 'Was das Zeichen aussagt',
				required: true,
			},
			{
				name: 'sourceCategory',
				type: 'string',
				description: 'Quellenkategorie',
				required: false,
				enum: [
					'gut',
					'tarot',
					'horoscope',
					'fortune-cookie',
					'iching',
					'dream',
					'person',
					'media',
					'natural',
					'other',
				],
			},
			{
				name: 'vibe',
				type: 'string',
				description: 'Grundstimmung des Zeichens',
				required: false,
				enum: ['good', 'bad', 'mysterious'],
			},
			{
				name: 'feltMeaning',
				type: 'string',
				description: 'Eigene Deutung (optional)',
				required: false,
			},
			{
				name: 'expectedOutcome',
				type: 'string',
				description: 'Konkrete Prognose (optional)',
				required: false,
			},
			{
				name: 'expectedBy',
				type: 'string',
				description: 'Bis wann sollte sich zeigen ob es eintritt (YYYY-MM-DD)',
				required: false,
			},
			{
				name: 'probability',
				type: 'number',
				description: 'Wahrscheinlichkeit 0..1 (optional)',
				required: false,
			},
			{
				name: 'tags',
				type: 'string',
				description: 'Tags durch Komma getrennt',
				required: false,
			},
		],
	},
	{
		name: 'resolve_sign',
		module: 'augur',
		description:
			'Loest ein offenes Zeichen auf — markiert ob es eingetreten ist (fulfilled / partly / not-fulfilled) und kann eine Notiz speichern.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'entryId', type: 'string', description: 'ID des Zeichens', required: true },
			{
				name: 'outcome',
				type: 'string',
				description: 'Ergebnis',
				required: true,
				enum: ['fulfilled', 'partly', 'not-fulfilled'],
			},
			{
				name: 'note',
				type: 'string',
				description: 'Optionale Notiz wie es kam',
				required: false,
			},
		],
	},
	{
		name: 'list_open_signs',
		module: 'augur',
		description:
			'Listet noch offene Zeichen — id, kind, source, claim, encounteredAt, expectedBy. Optional gefiltert nach kind.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'kind',
				type: 'string',
				description: 'Nur eine Art zeigen',
				required: false,
				enum: ['omen', 'fortune', 'hunch'],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 30)',
				required: false,
			},
		],
	},
	{
		name: 'consult_oracle',
		module: 'augur',
		description:
			'Befragt das Living Oracle: nimmt eine Sign-Beschreibung und gibt zurueck was bei aehnlichen Zeichen in der Vergangenheit geschah (n, hit-rate, breakdown). Schweigt unter 50 aufgeloesten Eintraegen oder unter 3 Treffern (cold-start).',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'kind',
				type: 'string',
				description: 'Art des hypothetischen Zeichens',
				required: true,
				enum: ['omen', 'fortune', 'hunch'],
			},
			{
				name: 'sourceCategory',
				type: 'string',
				description: 'Quellenkategorie',
				required: true,
				enum: [
					'gut',
					'tarot',
					'horoscope',
					'fortune-cookie',
					'iching',
					'dream',
					'person',
					'media',
					'natural',
					'other',
				],
			},
			{
				name: 'vibe',
				type: 'string',
				description: 'Grundstimmung',
				required: true,
				enum: ['good', 'bad', 'mysterious'],
			},
			{
				name: 'source',
				type: 'string',
				description: 'Quellen-Stichwort fuer Keyword-Matching',
				required: false,
			},
			{
				name: 'claim',
				type: 'string',
				description: 'Aussage fuer Keyword-Matching',
				required: false,
			},
			{
				name: 'tags',
				type: 'string',
				description: 'Tags durch Komma getrennt',
				required: false,
			},
		],
	},
	{
		name: 'augur_year_recap',
		module: 'augur',
		description:
			'Strukturierter Jahresrueckblick: total / aufgeloest / hit-rate / vibe-breakdown / top-source-categories. Year als YYYY (Standard: aktuelles Jahr).',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'year',
				type: 'number',
				description: 'Jahr (z.B. 2026). Standard: aktuelles Jahr.',
				required: false,
			},
		],
	},

	// ── Lasts (mirror sibling to firsts) ────────────────────────
	{
		name: 'create_last',
		module: 'lasts',
		description:
			'Erstellt einen neuen "Last" — ein letztes Mal, das markiert oder vermutet werden soll. Status standardmaessig "suspected"; "confirmed" nur setzen wenn der User sicher ist.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'title',
				type: 'string',
				description: 'Was zum letzten Mal passiert ist (z.B. "Letzter Tag im alten Job")',
				required: true,
			},
			{
				name: 'category',
				type: 'string',
				description: 'Kategorie',
				required: false,
				enum: [
					'culinary',
					'adventure',
					'travel',
					'people',
					'career',
					'creative',
					'nature',
					'culture',
					'health',
					'tech',
					'other',
				],
			},
			{
				name: 'status',
				type: 'string',
				description: 'Lifecycle-Status',
				required: false,
				enum: ['suspected', 'confirmed'],
			},
			{
				name: 'date',
				type: 'string',
				description: 'Datum des letzten Mals (YYYY-MM-DD), falls bekannt',
				required: false,
			},
			{
				name: 'confidence',
				type: 'string',
				description: 'Sicherheit, dass es das letzte Mal war',
				required: false,
				enum: ['probably', 'likely', 'certain'],
			},
			{
				name: 'meaning',
				type: 'string',
				description: 'Was es bedeutet hat (optional)',
				required: false,
			},
			{
				name: 'note',
				type: 'string',
				description: 'Freie Notiz (optional)',
				required: false,
			},
		],
	},
	{
		name: 'confirm_last',
		module: 'lasts',
		description:
			'Bewegt einen Last von "suspected" auf "confirmed" und ergaenzt Reflexionsfelder. Setzt Datum auf heute, falls keines uebergeben wird.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'lastId', type: 'string', description: 'ID des Lasts', required: true },
			{
				name: 'date',
				type: 'string',
				description: 'Datum des letzten Mals (YYYY-MM-DD)',
				required: false,
			},
			{
				name: 'meaning',
				type: 'string',
				description: 'Was es bedeutet hat',
				required: false,
			},
			{
				name: 'whatIKnewThen',
				type: 'string',
				description: 'Was du damals nicht wusstest',
				required: false,
			},
			{
				name: 'whatIKnowNow',
				type: 'string',
				description: 'Was du heute siehst',
				required: false,
			},
			{
				name: 'tenderness',
				type: 'number',
				description: 'Wie sehr es dich heute beruehrt (1-5)',
				required: false,
			},
			{
				name: 'wouldReclaim',
				type: 'string',
				description: 'Wuerdest du es zurueckholen?',
				required: false,
				enum: ['no', 'maybe', 'yes'],
			},
		],
	},
	{
		name: 'reclaim_last',
		module: 'lasts',
		description:
			'Markiert einen Last als "aufgehoben" — es ist wieder passiert. Optionaler Notiz-Text beschreibt, was zurueckgekommen ist.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'lastId', type: 'string', description: 'ID des Lasts', required: true },
			{
				name: 'reclaimedNote',
				type: 'string',
				description: 'Was ist wieder passiert (optional)',
				required: false,
			},
		],
	},
	{
		name: 'list_lasts',
		module: 'lasts',
		description:
			'Listet Lasts (id, title, status, category, date). Optional nach Status oder Kategorie filterbar.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'status',
				type: 'string',
				description: 'Nur einen Status zeigen',
				required: false,
				enum: ['suspected', 'confirmed', 'reclaimed'],
			},
			{
				name: 'category',
				type: 'string',
				description: 'Nur eine Kategorie zeigen',
				required: false,
				enum: [
					'culinary',
					'adventure',
					'travel',
					'people',
					'career',
					'creative',
					'nature',
					'culture',
					'health',
					'tech',
					'other',
				],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 30)',
				required: false,
			},
		],
	},
	{
		name: 'suggest_lasts',
		module: 'lasts',
		description:
			'Laesst die Inferenz-Engine ueber places/habits/contacts scannen und generiert "suspected"-Lasts mit inferredFrom-Provenance fuer Eintraege, die Frequenz-Drops zeigen. Dedupliziert gegen existierende Lasts und die Cooldown-Liste. Schreibt direkt in die Inbox — kein Proposal-Workflow noetig, weil die Eintraege als suspected landen und der User sie dort akzeptieren oder verwerfen kann.',
		defaultPolicy: 'auto',
		parameters: [],
	},

	// ── Forms ───────────────────────────────────────────────────
	// Eigenes Modul fuer Typeform-aehnliche Formulare. Plan:
	// docs/plans/forms-module.md M5.
	{
		name: 'forms_create',
		module: 'forms',
		description:
			'Legt ein neues Formular an. Status ist immer "draft" (publishen via forms_publish). Felder optional als Array — der Planner kann z.B. fuer eine Vereins-Anmeldung mehrere short_text + email + consent Felder auf einmal vorschlagen.',
		defaultPolicy: 'propose',
		parameters: [
			{
				name: 'title',
				type: 'string',
				description: 'Titel des Formulars (z.B. "Anmeldung Sommerfest")',
				required: true,
			},
			{
				name: 'description',
				type: 'string',
				description: 'Optionaler Beschreibungstext oben im Formular',
				required: false,
			},
			{
				name: 'fields',
				type: 'array',
				description:
					'Optionales Array von Feld-Definitionen. Jedes Feld: { type, label, required?, helpText?, options?: [{label}] }. Erlaubte type-Werte: short_text | long_text | single_choice | multi_choice | number | date | email | yes_no | rating | section | consent.',
				required: false,
			},
		],
	},
	{
		name: 'forms_add_field',
		module: 'forms',
		description:
			'Fuegt einem bestehenden Formular ein einzelnes Feld hinzu. Ans Ende der Feldliste angehaengt — Reorder ist nicht ueber dieses Tool moeglich (User macht das per Drag im Builder).',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'formId', type: 'string', description: 'ID des Formulars', required: true },
			{
				name: 'type',
				type: 'string',
				description: 'Feldtyp',
				required: true,
				enum: [
					'short_text',
					'long_text',
					'single_choice',
					'multi_choice',
					'number',
					'date',
					'email',
					'yes_no',
					'rating',
					'section',
					'consent',
				],
			},
			{ name: 'label', type: 'string', description: 'Label / Frage des Feldes', required: true },
			{ name: 'helpText', type: 'string', description: 'Hilfetext (optional)', required: false },
			{
				name: 'required',
				type: 'boolean',
				description: 'Pflichtfeld (Standard false)',
				required: false,
			},
			{
				name: 'options',
				type: 'array',
				description:
					'Bei single_choice / multi_choice: Array von { label: string } — IDs werden generiert.',
				required: false,
			},
		],
	},
	{
		name: 'forms_publish',
		module: 'forms',
		description:
			'Bewegt ein Formular von "draft" auf "published". Erst nach diesem Schritt kann der User die Sichtbarkeit auf "unlisted" setzen und einen Share-Link erzeugen. Wirft, wenn das Formular keine Antwortfelder hat (nur section/consent).',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'formId', type: 'string', description: 'ID des Formulars', required: true },
		],
	},
	{
		name: 'forms_close',
		module: 'forms',
		description:
			'Setzt ein veroeffentlichtes Formular auf "closed" — keine neuen Antworten mehr. Existierende Antworten und der Share-Link bleiben erhalten; das Formular wird aber im SharedFormView nicht mehr submitbar gerendert.',
		defaultPolicy: 'propose',
		parameters: [
			{ name: 'formId', type: 'string', description: 'ID des Formulars', required: true },
		],
	},
	{
		name: 'forms_list',
		module: 'forms',
		description:
			'Listet Formulare im aktiven Space (id, title, status, fieldCount, responseCount, visibility). Optional nach Status filterbar.',
		defaultPolicy: 'auto',
		parameters: [
			{
				name: 'status',
				type: 'string',
				description: 'Nur einen Status zeigen',
				required: false,
				enum: ['draft', 'published', 'closed'],
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximale Anzahl (Standard 50)',
				required: false,
			},
		],
	},
	{
		name: 'forms_get_responses',
		module: 'forms',
		description:
			'Liefert Aggregate ueber die Antworten eines Formulars: responseCount pro Status, pro Choice-Feld eine Histogramm-Map (option-label → count), pro Text-Feld eine Liste der ersten N Antworten. Antworten werden client-side entschluesselt; vault-locked → leerer Antwort-Vector.',
		defaultPolicy: 'auto',
		parameters: [
			{ name: 'formId', type: 'string', description: 'ID des Formulars', required: true },
			{
				name: 'limit',
				type: 'number',
				description: 'Max. Text-Antworten pro Feld (Standard 50)',
				required: false,
			},
		],
	},
	{
		name: 'forms_summarize_responses',
		module: 'forms',
		description:
			'Sammelt rohe Text-Antworten + Choice-Histogramme eines Formulars und gibt sie als strukturierte Payload zurueck, damit der naechste Planner-Schritt thematisch clustern kann (Augur-style). Reine Daten-Extraktion — keine eigene LLM-Roundtrip. Ideal in einer Mission "Fasse die Pulse-Check-Antworten der Woche zusammen".',
		defaultPolicy: 'auto',
		parameters: [
			{ name: 'formId', type: 'string', description: 'ID des Formulars', required: true },
			{
				name: 'sinceDays',
				type: 'number',
				description: 'Nur Antworten der letzten N Tage einbeziehen (Standard: alle)',
				required: false,
			},
		],
	},
];

// ═══════════════════════════════════════════════════════════════
//  DERIVED LOOKUPS
// ═══════════════════════════════════════════════════════════════

/** O(1) lookup by tool name. */
export const AI_TOOL_CATALOG_BY_NAME: ReadonlyMap<string, ToolSchema> = new Map(
	AI_TOOL_CATALOG.map((t) => [t.name, t])
);
