/**
 * Central configuration for all Mana ecosystem apps
 * This is the single source of truth for AppSlider components
 */

import { APP_ICONS } from './app-icons';
import type { AppIconId } from './app-icons';

export type AppStatus = 'published' | 'beta' | 'development' | 'planning';

/**
 * Access tier hierarchy (higher number = more access):
 * guest(0) < public(1) < beta(2) < alpha(3) < founder(4)
 */
export type AccessTier = 'guest' | 'public' | 'beta' | 'alpha' | 'founder';

const TIER_LEVELS: Record<AccessTier, number> = {
	guest: 0,
	public: 1,
	beta: 2,
	alpha: 3,
	founder: 4,
};

/**
 * Check if a user's tier meets the required tier for an app
 */
export function hasAppAccess(userTier: string, requiredTier: AccessTier): boolean {
	const userLevel = TIER_LEVELS[userTier as AccessTier] ?? 0;
	const requiredLevel = TIER_LEVELS[requiredTier] ?? 0;
	return userLevel >= requiredLevel;
}

/**
 * Get the numeric level for a tier (for comparisons)
 */
export function getTierLevel(tier: string): number {
	return TIER_LEVELS[tier as AccessTier] ?? 0;
}

/**
 * Tier display labels
 */
export const ACCESS_TIER_LABELS = {
	de: {
		guest: 'Gast',
		public: 'Standard',
		beta: 'Beta',
		alpha: 'Alpha',
		founder: 'Founder',
	},
	en: {
		guest: 'Guest',
		public: 'Standard',
		beta: 'Beta',
		alpha: 'Alpha',
		founder: 'Founder',
	},
} as const;

export interface ManaApp {
	id: AppIconId;
	name: string;
	description: {
		de: string;
		en: string;
	};
	longDescription: {
		de: string;
		en: string;
	};
	icon: string; // Data URL from APP_ICONS
	color: string;
	comingSoon: boolean;
	status: AppStatus;
	/** Minimum access tier required to use this app */
	requiredTier: AccessTier;
	url?: string; // Optional URL for the app
	/** Whether this app is archived (in apps-archived folder) */
	archived?: boolean;
}

/**
 * All apps in the Mana ecosystem
 * Order determines display order in AppSlider
 */
export const MANA_APPS: ManaApp[] = [
	{
		id: 'mana',
		name: 'Mana',
		description: {
			de: 'Multi-App Ecosystem',
			en: 'Multi-App Ecosystem',
		},
		longDescription: {
			de: 'Das zentrale Dashboard für alle Mana-Apps mit SSO, Credits und App-Verwaltung.',
			en: 'The central dashboard for all Mana apps with SSO, credits, and app management.',
		},
		icon: APP_ICONS.mana,
		color: '#6366f1',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'chat',
		name: 'ManaChat',
		description: {
			de: 'KI Chat Assistent',
			en: 'AI Chat Assistant',
		},
		longDescription: {
			de: 'Dein intelligenter KI-Begleiter für Gespräche, Fragen und kreative Aufgaben.',
			en: 'Your intelligent AI companion for conversations, questions, and creative tasks.',
		},
		icon: APP_ICONS.chat,
		color: '#0ea5e9',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'presi',
		name: 'Presi',
		description: {
			de: 'Präsentations-Creator',
			en: 'Presentation Creator',
		},
		longDescription: {
			de: 'Erstelle beeindruckende Präsentationen mit KI-gestützten Design-Vorschlägen.',
			en: 'Create stunning presentations with AI-powered design suggestions.',
		},
		icon: APP_ICONS.presi,
		color: '#f97316',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	// Cards/Cardecky: dekommissioniert 2026-05-08 — eigenständig auf
	// cardecky.mana.how (git.mana.how/till/cards). App-Eintrag bleibt
	// nur in der Standalone-App.
	{
		id: 'quiz',
		name: 'Quiz',
		description: {
			de: 'Wissen testen',
			en: 'Test your knowledge',
		},
		longDescription: {
			de: 'Eigene Quizze bauen und spielen — Single-, Multiple-Choice, Wahr/Falsch oder Freitext.',
			en: 'Build and play your own quizzes — single/multiple choice, true/false, or free text.',
		},
		icon: APP_ICONS.quiz,
		color: '#ec4899',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'forms',
		name: 'Forms',
		description: {
			de: 'Formulare bauen',
			en: 'Build forms',
		},
		longDescription: {
			de: 'Eigene Formulare bauen, öffentlich teilen und Antworten sammeln. Anmeldungen, Umfragen, Lead-Capture, wiederkehrende Pulse-Checks. Mit AI-Builder, Conditional Branching und Auto-Sync zu Kontakten, Events und Spaces.',
			en: 'Build your own forms, share them publicly, and collect responses. Sign-ups, surveys, lead capture, recurring pulse checks. With AI builder, conditional branching, and auto-sync to contacts, events, and Spaces.',
		},
		icon: APP_ICONS.forms,
		color: '#14b8a6',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'beta' before release (see project_tier_patch_resolved memory)
	},
	{
		id: 'picture',
		name: 'ManaPicture',
		description: {
			de: 'KI Bildgenerierung',
			en: 'AI Image Generation',
		},
		longDescription: {
			de: 'Erschaffe einzigartige Bilder mit der Kraft künstlicher Intelligenz.',
			en: 'Create unique images with the power of artificial intelligence.',
		},
		icon: APP_ICONS.picture,
		color: '#22c55e',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'quotes',
		name: 'Quotes',
		description: {
			de: 'Tägliche Inspiration',
			en: 'Daily Inspiration',
		},
		longDescription: {
			de: 'Entdecke inspirierende Zitate und Weisheiten für jeden Tag.',
			en: 'Discover inspiring quotes and wisdom for every day.',
		},
		icon: APP_ICONS.quotes,
		color: '#f59e0b',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'wisekeep',
		name: 'WiseKeep',
		description: {
			de: 'KI Wissensextraktion',
			en: 'AI Knowledge Extraction',
		},
		longDescription: {
			de: 'Extrahiere Weisheiten und Erkenntnisse aus Videos und Texten.',
			en: 'Extract wisdom and insights from videos and texts.',
		},
		icon: APP_ICONS.wisekeep,
		color: '#6366f1',
		comingSoon: false,
		status: 'planning',
		requiredTier: 'guest',
		archived: true,
	},
	{
		id: 'contacts',
		name: 'Kontakte',
		description: {
			de: 'Kontaktverwaltung',
			en: 'Contact Management',
		},
		longDescription: {
			de: 'Verwalte deine Kontakte übersichtlich mit Gruppen, Tags und Notizen.',
			en: 'Manage your contacts clearly with groups, tags, and notes.',
		},
		icon: APP_ICONS.contacts,
		color: '#3b82f6',
		comingSoon: false,
		status: 'published',
		requiredTier: 'guest',
	},
	{
		id: 'calendar',
		name: 'Kalender',
		description: {
			de: 'Smarte Kalenderverwaltung',
			en: 'Smart Calendar Management',
		},
		longDescription: {
			de: 'Organisiere deine Zeit intelligent mit persönlichen und geteilten Kalendern, wiederkehrenden Terminen und Erinnerungen.',
			en: 'Organize your time intelligently with personal and shared calendars, recurring events, and reminders.',
		},
		icon: APP_ICONS.calendar,
		color: '#0ea5e9',
		comingSoon: false,
		status: 'published',
		requiredTier: 'guest',
	},
	{
		id: 'storage',
		name: 'Storage',
		description: {
			de: 'Cloud-Speicherung',
			en: 'Cloud Storage',
		},
		longDescription: {
			de: 'Sichere Cloud-Speicherung für deine Dateien mit Ordnern, Versionierung, Sharing und mehr.',
			en: 'Secure cloud storage for your files with folders, versioning, sharing, and more.',
		},
		icon: APP_ICONS.storage,
		color: '#3b82f6',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	// Clock consolidated into Times
	{
		id: 'todo',
		name: 'Todo',
		description: {
			de: 'Aufgabenverwaltung',
			en: 'Task Management',
		},
		longDescription: {
			de: 'Verwalte Aufgaben mit Projekten, Labels, Subtasks und wiederkehrenden Terminen.',
			en: 'Manage tasks with projects, labels, subtasks, and recurring schedules.',
		},
		icon: APP_ICONS.todo,
		color: '#8b5cf6',
		comingSoon: false,
		status: 'published',
		requiredTier: 'guest',
	},
	{
		id: 'mail',
		name: 'ManaMail',
		description: {
			de: 'Smart Email Client',
			en: 'Smart Email Client',
		},
		longDescription: {
			de: 'Intelligenter E-Mail-Client mit KI-Zusammenfassungen, Smart Reply und Multi-Account-Unterstützung.',
			en: 'Intelligent email client with AI summaries, smart reply, and multi-account support.',
		},
		icon: APP_ICONS.mail,
		color: '#6366f1',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'moodlit',
		name: 'Moodlit',
		description: {
			de: 'Ambient Lighting & Moods',
			en: 'Ambient Lighting & Moods',
		},
		longDescription: {
			de: 'Erstelle beruhigende Lichtstimmungen mit animierten Farbverläufen für entspannte Atmosphäre.',
			en: 'Create calming ambient lighting with animated color gradients for a relaxed atmosphere.',
		},
		icon: APP_ICONS.moodlit,
		color: '#8b5cf6',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'inventory',
		name: 'Inventory',
		description: {
			de: 'Besitz-Verwaltung',
			en: 'Inventory Management',
		},
		longDescription: {
			de: 'Verwalte deinen Besitz mit Fotos, Kaufbelegen, Garantie-Dokumenten, Kategorien und Standorten.',
			en: 'Manage your belongings with photos, receipts, warranty documents, categories, and locations.',
		},
		icon: APP_ICONS.inventory,
		color: '#14b8a6',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'comic',
		name: 'Comic',
		description: {
			de: 'Aus Text wird ein Comic',
			en: 'Turn text into comics',
		},
		longDescription: {
			de: 'Erstelle mehrseitige Comics mit KI. Starte mit einem Tagebuch-Eintrag, einer Notiz oder einem Kalender-Event und generiere Panels in fünf Stilen — Comic, Manga, Cartoon, Graphic Novel oder Webtoon. Du selbst bist der Protagonist.',
			en: 'Create multi-panel comics with AI. Start from a journal entry, note, or calendar event and generate panels in five styles — comic, manga, cartoon, graphic novel, or webtoon. You are the protagonist.',
		},
		icon: APP_ICONS.comic,
		color: '#f97316',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'beta' before release
	},
	{
		id: 'questions',
		name: 'Questions',
		description: {
			de: 'KI Recherche-Assistent',
			en: 'AI Research Assistant',
		},
		longDescription: {
			de: 'Sammle Fragen und erhalte umfassende Antworten durch KI-gestützte Web-Recherche.',
			en: 'Collect questions and get comprehensive answers through AI-powered web research.',
		},
		icon: APP_ICONS.questions,
		color: '#8b5cf6',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'times',
		name: 'Times',
		description: {
			de: 'Zeiterfassung, Uhren & Timer',
			en: 'Time Tracking, Clocks & Timers',
		},
		longDescription: {
			de: 'Professionelle Zeiterfassung mit Timer, Projekten, Kunden, Reports, Weltzeituhr, Wecker, Stoppuhr und Pomodoro.',
			en: 'Professional time tracking with timer, projects, clients, reports, world clock, alarms, stopwatch, and pomodoro.',
		},
		icon: APP_ICONS.times,
		color: '#f59e0b',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'uload',
		name: 'uLoad',
		description: {
			de: 'URL-Shortener & Link-Management',
			en: 'URL Shortener & Link Management',
		},
		longDescription: {
			de: 'Kürze URLs, tracke Klicks und verwalte deine Links.',
			en: 'Shorten URLs, track clicks, and manage your links.',
		},
		icon: APP_ICONS.uload,
		color: '#6366f1',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'news',
		name: 'News Hub',
		description: {
			de: 'Kuratierter Newsfeed',
			en: 'Curated News Feed',
		},
		longDescription: {
			de: 'Kuratierter Newsfeed aus öffentlichen Quellen mit persönlicher Leseliste — wähle Themen aus, blende Quellen aus und bau dir deinen eigenen Feed.',
			en: 'Curated news feed from public sources with a personal reading list — pick topics, hide sources, and shape your own feed.',
		},
		icon: APP_ICONS.news,
		color: '#10b981',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'news-research',
		name: 'News Research',
		description: {
			de: 'RSS-Feeds finden & durchsuchen',
			en: 'Find & search RSS feeds',
		},
		longDescription: {
			de: 'Entdecke zum Thema passende RSS-Feeds, filtere die Artikel nach Stichworten und exportiere die Treffer als KI-Kontext oder in deine Leseliste.',
			en: 'Discover topic-matched RSS feeds, filter articles by keyword, and export hits as AI context or into your reading list.',
		},
		icon: APP_ICONS['news-research'],
		color: '#0891b2',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'research-lab',
		name: 'Research Lab',
		description: {
			de: 'Web-Research Anbieter Seite-an-Seite vergleichen',
			en: 'Compare web-research providers side-by-side',
		},
		longDescription: {
			de: 'Schick dieselbe Anfrage parallel an bis zu fünf Anbieter (Brave, Tavily, Exa, Perplexity, Claude, Gemini, OpenAI …) und vergleich Antworten, Latenzen und Kosten in einer Ansicht. Alle Runs werden serverseitig persistiert für spätere Auswertung.',
			en: 'Send the same query to up to five providers in parallel (Brave, Tavily, Exa, Perplexity, Claude, Gemini, OpenAI …) and compare answers, latency, and cost side-by-side. All runs are persisted server-side for later review.',
		},
		icon: APP_ICONS['research-lab'],
		color: '#8b5cf6',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'beta' before release
	},
	{
		id: 'calc',
		name: 'Calc',
		description: {
			de: 'Taschenrechner & Umrechner',
			en: 'Calculator & Converter',
		},
		longDescription: {
			de: 'Taschenrechner mit Standard, Wissenschaftlich, Programmierer, Einheiten, Währung und Finanzrechnern.',
			en: 'Calculator with standard, scientific, programmer, unit, currency and finance modes.',
		},
		icon: APP_ICONS.calc,
		color: '#ec4899',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'guides',
		name: 'Guides',
		description: {
			de: 'Schritt-für-Schritt Anleitungen',
			en: 'Step-by-Step Guides',
		},
		longDescription: {
			de: 'Erstelle und führe strukturierte Anleitungen aus — Rezepte, SOPs, Lernpfade und Playbooks mit Ausführungshistorie.',
			en: 'Create and execute structured guides — recipes, SOPs, learning paths, and playbooks with run history.',
		},
		icon: APP_ICONS.guides,
		color: '#0d9488',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'music',
		name: 'Music',
		description: {
			de: 'Musikproduktion',
			en: 'Music Production',
		},
		longDescription: {
			de: 'Erstelle und verwalte Songs, Playlists und Musikprojekte mit Markern und Arrangements.',
			en: 'Create and manage songs, playlists, and music projects with markers and arrangements.',
		},
		icon: APP_ICONS.music,
		color: '#ec4899',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'photos',
		name: 'Photos',
		description: {
			de: 'Fotoverwaltung',
			en: 'Photo Management',
		},
		longDescription: {
			de: 'Verwalte deine Fotos mit Alben, Tags und Favoriten.',
			en: 'Manage your photos with albums, tags, and favorites.',
		},
		icon: APP_ICONS.photos,
		color: '#8b5cf6',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'skilltree',
		name: 'SkillTree',
		description: {
			de: 'Skill-Tracking',
			en: 'Skill Tracking',
		},
		longDescription: {
			de: 'Verfolge deinen Lernfortschritt mit Skills, Aktivitäten und Achievements.',
			en: 'Track your learning progress with skills, activities, and achievements.',
		},
		icon: APP_ICONS.skilltree,
		color: '#f59e0b',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest',
	},
	{
		id: 'body',
		name: 'Body',
		description: {
			de: 'Training & Körper-Tracking',
			en: 'Training & Body Tracking',
		},
		longDescription: {
			de: 'Logge Workouts, Sätze und progressive Steigerung neben Gewicht, Maßen und täglichen Energie-Checks. Eine App für alles, was deinen Körper bewegt und verändert.',
			en: 'Log workouts, sets, and progressive overload alongside weight, measurements, and daily energy check-ins. One app for everything that moves and changes your body.',
		},
		icon: APP_ICONS.body,
		color: '#ef4444',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'habits',
		name: 'Habits',
		description: {
			de: 'Gewohnheiten tracken',
			en: 'Habit Tracking',
		},
		longDescription: {
			de: 'Schnelles Tally-Tracking für Gewohnheiten wie Kaffee, Zigaretten, Wasser — ein Tap pro Eintrag mit Tagesstatistiken und Streaks.',
			en: 'Quick tally tracking for habits like coffee, cigarettes, water — one tap per entry with daily stats and streaks.',
		},
		icon: APP_ICONS.habits,
		color: '#8b5cf6',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'journal',
		name: 'Journal',
		description: {
			de: 'Tagebuch',
			en: 'Journal',
		},
		longDescription: {
			de: 'Täglich deine Gedanken und Gefühle festhalten. Mit Stimmungen, Tags, Streak-Tracking und historischen Rückblicken.',
			en: 'Capture your thoughts and feelings daily. With moods, tags, streak tracking, and historical recaps.',
		},
		icon: APP_ICONS.journal,
		color: '#6366f1',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'notes',
		name: 'Notes',
		description: {
			de: 'Schnelle Notizen',
			en: 'Quick Notes',
		},
		longDescription: {
			de: 'Leichtgewichtige Notizen mit Suche, Farbmarkierungen und Pin-Funktion. Kein Overhead, sofort losschreiben.',
			en: 'Lightweight notes with search, color tags, and pinning. No overhead, start writing immediately.',
		},
		icon: APP_ICONS.notes,
		color: '#f59e0b',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'dreams',
		name: 'Dreams',
		description: {
			de: 'Traumtagebuch',
			en: 'Dream Journal',
		},
		longDescription: {
			de: 'Halte deine Träume fest, bevor sie verblassen. Stimmung, Klartraum-Status, wiederkehrende Symbole und Insights über die Zeit.',
			en: 'Capture your dreams before they fade. Mood, lucid status, recurring symbols, and insights over time.',
		},
		icon: APP_ICONS.dreams,
		color: '#6366f1',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'firsts',
		name: 'Erste Male',
		description: {
			de: 'Erste Male',
			en: 'First Times',
		},
		longDescription: {
			de: 'Halte deine ersten Male fest — von Bucket-List-Träumen bis zu erlebten Momenten. Mit Personen, Orten, Fotos und dem Vorher/Nachher-Gefühl.',
			en: 'Track your first times — from bucket list dreams to lived moments. With people, places, photos, and the before/after feeling.',
		},
		icon: APP_ICONS.firsts,
		color: '#f59e0b',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'lasts',
		name: 'Letzte Male',
		description: {
			de: 'Letzte Male',
			en: 'Last Times',
		},
		longDescription: {
			de: 'Halte fest, was zum letzten Mal passiert ist — bewusst markiert oder rückwirkend erkannt. Spiegelbild zu Firsts: leise Reflexion statt Vorfreude.',
			en: 'Capture what happened for the last time — marked deliberately or recognised in hindsight. Mirror sibling to Firsts: quiet reflection instead of anticipation.',
		},
		icon: APP_ICONS.lasts,
		color: '#6366f1',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'beta' before release (see project_tier_patch_resolved memory)
	},
	{
		id: 'period',
		name: 'Periode',
		description: {
			de: 'Menstruationszyklus-Tracking',
			en: 'Menstrual Cycle Tracking',
		},
		longDescription: {
			de: 'Tracke deinen Zyklus mit Blutungstagen, Symptomen, Stimmung und Basaltemperatur. Phasen-Erkennung und Vorhersage für die nächste Periode und das fruchtbare Fenster.',
			en: 'Track your cycle with flow days, symptoms, mood, and basal temperature. Phase detection and prediction of the next period and fertile window.',
		},
		icon: APP_ICONS.period,
		color: '#ec4899',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'events',
		name: 'Events',
		description: {
			de: 'Veranstaltungen mit Gästeliste',
			en: 'Gatherings with guest lists',
		},
		longDescription: {
			de: 'Plane Geburtstage, Dinner und Workshops mit Gästeliste, RSVPs und teilbaren Einladungslinks. Events erscheinen automatisch in deinem Kalender.',
			en: 'Plan birthdays, dinners, and workshops with guest lists, RSVPs, and shareable invite links. Events appear automatically in your calendar.',
		},
		icon: APP_ICONS.events,
		color: '#f43f5e',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'finance',
		name: 'Finance',
		description: {
			de: 'Einnahmen & Ausgaben',
			en: 'Income & Expenses',
		},
		longDescription: {
			de: 'Einfaches Finanztracking mit Kategorien, Monatsbudgets und Übersicht deiner Einnahmen und Ausgaben.',
			en: 'Simple finance tracking with categories, monthly budgets, and overview of your income and expenses.',
		},
		icon: APP_ICONS.finance,
		color: '#22c55e',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'places',
		name: 'Places',
		description: {
			de: 'Standort-Tracking',
			en: 'Location Tracking',
		},
		longDescription: {
			de: 'Tracke deinen Standort, erstelle Orte und sieh deine Bewegungshistorie.',
			en: 'Track your location, create places, and view your movement history.',
		},
		icon: APP_ICONS.places,
		color: '#0ea5e9',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'drink',
		name: 'Drink',
		description: {
			de: 'Getränke-Tracker',
			en: 'Beverage Tracker',
		},
		longDescription: {
			de: 'Tracke alle Getränke — Wasser, Kaffee, Tee, Saft, Alkohol und mehr. Mit Tageszielen, Favoriten und Verlauf.',
			en: 'Track all beverages — water, coffee, tea, juice, alcohol, and more. With daily goals, favourites, and history.',
		},
		icon: APP_ICONS.drink,
		color: '#3b82f6',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'recipes',
		name: 'Rezepte',
		description: {
			de: 'Rezeptsammlung',
			en: 'Recipe Collection',
		},
		longDescription: {
			de: 'Sammle und organisiere deine Lieblingsrezepte — mit Zutaten, Schritten, Fotos und Tags.',
			en: 'Collect and organize your favorite recipes — with ingredients, steps, photos, and tags.',
		},
		icon: APP_ICONS.recipes,
		color: '#f97316',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'stretch',
		name: 'Stretch',
		description: {
			de: 'Geführtes Dehnen',
			en: 'Guided Stretching',
		},
		longDescription: {
			de: 'Bleib flexibel mit Beweglichkeits-Checks, geführten Dehnroutinen, Streak-Tracking und Erinnerungen über den Tag. Morgenroutine, Schreibtisch-Pause oder Abendroutine — alles mit Timer.',
			en: 'Stay flexible with mobility assessments, guided stretch routines, streak tracking, and reminders throughout your day. Morning routine, desk break, or evening flow — all with a timer.',
		},
		icon: APP_ICONS.stretch,
		color: '#10b981',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'meditate',
		name: 'Meditate',
		description: {
			de: 'Meditation & Atemübungen',
			en: 'Meditation & Breathing',
		},
		longDescription: {
			de: 'Meditations-Timer, geführte Atemübungen (Box Breathing, 4-7-8, Wim Hof), Body Scans und Stimmungstracking. Finde deine Ruhe — mit Streak-Tracking und Session-Verlauf.',
			en: 'Meditation timer, guided breathing exercises (Box Breathing, 4-7-8, Wim Hof), body scans, and mood tracking. Find your calm — with streak tracking and session history.',
		},
		icon: APP_ICONS.meditate,
		color: '#8b5cf6',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'sleep',
		name: 'Sleep',
		description: {
			de: 'Schlaf-Tracking',
			en: 'Sleep Tracking',
		},
		longDescription: {
			de: 'Tracke deinen Schlaf mit Zeiten, Qualität und Schlafhygiene. Wochen-Trends, Schlafschuld, Konsistenz-Score und Verknüpfung mit Träumen.',
			en: 'Track your sleep with times, quality, and sleep hygiene. Weekly trends, sleep debt, consistency score, and dream linking.',
		},
		icon: APP_ICONS.sleep,
		color: '#6366f1',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},

	{
		id: 'mood',
		name: 'Mood',
		description: {
			de: 'Stimmungs-Tracking',
			en: 'Mood Tracking',
		},
		longDescription: {
			de: 'Tracke deine Stimmung mehrmals am Tag mit Emotionen, Kontext und Aktivität. Erkenne Muster: Wochentage, Tageszeiten, Aktivitäten — und wie sie deine Laune beeinflussen.',
			en: 'Track your mood multiple times a day with emotions, context, and activity. Discover patterns: weekdays, times of day, activities — and how they affect your mood.',
		},
		icon: APP_ICONS.mood,
		color: '#f59e0b',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},

	// ── Companion Brain ─────────────────────────────────

	{
		id: 'myday',
		name: 'Mein Tag',
		description: { de: 'Tagesueberblick', en: 'Daily Overview' },
		longDescription: {
			de: 'Alle wichtigen Daten auf einen Blick: Tasks, Termine, Wasser, Ernaehrung, Streaks.',
			en: 'All key data at a glance: tasks, events, water, nutrition, streaks.',
		},
		icon: APP_ICONS.myday ?? '☀️',
		color: '#F59E0B',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'activity',
		name: 'Aktivität',
		description: { de: 'Live Aktivitäts-Stream', en: 'Live Activity Stream' },
		longDescription: {
			de: 'Echtzeit-Feed aller Aktionen ueber alle Module: Tasks, Drinks, Termine, Mahlzeiten.',
			en: 'Real-time feed of all actions across modules: tasks, drinks, events, meals.',
		},
		icon: APP_ICONS.activity ?? '⚡',
		color: '#6366F1',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'companion',
		name: 'Companion',
		description: { de: 'AI Assistent', en: 'AI Assistant' },
		longDescription: {
			de: 'Dein persoenlicher AI-Begleiter. Fragt nach deinem Tag, erstellt Tasks, loggt Getraenke — alles per Chat.',
			en: 'Your personal AI companion. Ask about your day, create tasks, log drinks — all via chat.',
		},
		icon: APP_ICONS.companion ?? '🤖',
		color: '#8B5CF6',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'goals',
		name: 'Ziele',
		description: { de: 'Ziele & Fortschritt', en: 'Goals & Progress' },
		longDescription: {
			de: 'Setze moduluebergreifende Ziele (Wasser, Tasks, Kalorien) und tracke deinen Fortschritt automatisch.',
			en: 'Set cross-module goals (water, tasks, calories) and track progress automatically.',
		},
		icon: APP_ICONS.goals ?? '🎯',
		color: '#10B981',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'wetter',
		name: 'Wetter',
		description: {
			de: 'Wetter & Regenradar',
			en: 'Weather & Rain Radar',
		},
		longDescription: {
			de: 'Aktuelle Wetterdaten, Vorhersage und Regenradar fuer die DACH-Region. DWD-Warnungen und Minuten-Niederschlagsprognose.',
			en: 'Current weather, forecast, and rain radar for the DACH region. DWD alerts and minute-level precipitation nowcast.',
		},
		icon: APP_ICONS.wetter,
		color: '#38bdf8',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'library',
		name: 'Bibliothek',
		description: {
			de: 'Bücher, Filme, Serien, Comics',
			en: 'Books, Movies, Series, Comics',
		},
		longDescription: {
			de: 'Protokolliere was du liest und schaust — Bücher, Filme, Serien, Comics. Mit Status, Rating, Fortschritt und Jahresrückblick.',
			en: 'Log what you read and watch — books, movies, series, comics. With status, rating, progress tracking and year-in-review.',
		},
		icon: APP_ICONS.library,
		color: '#a855f7',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'articles',
		name: 'Artikel',
		description: {
			de: 'Später lesen — offline',
			en: 'Read later — offline',
		},
		longDescription: {
			de: 'Speichere Web-Artikel und lies sie offline im Reader — mit Highlights, Tags und Notizen. Ein Zuhause für alles, das du später in Ruhe lesen willst.',
			en: 'Save web articles and read them offline in a distraction-free reader — with highlights, tags and notes. A home for everything you want to read properly later.',
		},
		icon: APP_ICONS.articles,
		color: '#f97316',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'writing',
		name: 'Schreiben',
		description: {
			de: 'KI-Ghostwriter für Texte',
			en: 'AI ghostwriter for prose',
		},
		longDescription: {
			de: 'Brief dem KI-Agenten Thema, Stil und Referenzen — er schreibt den Text. Blog, Essay, E-Mail, Bewerbung, Social Post, Rede, Story und mehr. Mit versionierten Entwürfen und Selection-Refinements.',
			en: 'Brief the AI agent with topic, style and references — it writes the text. Blog posts, essays, emails, cover letters, social posts, speeches, stories and more. Versioned drafts with selection-based refinements.',
		},
		icon: APP_ICONS.writing,
		color: '#0ea5e9',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'beta' before release
	},
	{
		id: 'broadcasts',
		name: 'Broadcasts',
		description: {
			de: 'Newsletter & Kampagnen',
			en: 'Newsletters & campaigns',
		},
		longDescription: {
			de: 'Newsletter und Ankündigungen an Kontaktgruppen versenden — mit Rich-Text-Editor, Open/Click-Tracking, DSGVO-konformem Unsubscribe und Kampagnen-Statistik.',
			en: 'Send newsletters and announcements to contact segments — with a rich-text editor, open/click tracking, GDPR-compliant unsubscribe, and per-campaign stats.',
		},
		icon: APP_ICONS.broadcasts,
		color: '#6366f1',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'alpha' before release
	},
	{
		id: 'invoices',
		name: 'Rechnungen',
		description: {
			de: 'Rechnungen stellen mit QR-Bill',
			en: 'Issue invoices with Swiss QR-Bill',
		},
		longDescription: {
			de: 'Rechnungen an Kunden stellen — mit PDF-Export, Schweizer QR-Rechnung, Mehrwertsteuer und Zahlungsverfolgung. Ergänzt das Finance-Modul um die Outbound-Seite.',
			en: 'Issue invoices to clients — with PDF export, Swiss QR-Bill, VAT handling and payment tracking. Adds the outbound side to the Finance module.',
		},
		icon: APP_ICONS.invoices,
		color: '#059669',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'alpha' before release
	},
	{
		id: 'agents',
		name: 'Agents',
		description: {
			de: 'KI-Agenten verwalten',
			en: 'Manage AI agents',
		},
		longDescription: {
			de: 'Lege mehrere KI-Agenten an — jeder mit eigenem Namen, Avatar, System-Prompt, Memory und Tool-Policy. Agents führen autonome Missions aus und schreiben unter ihrer eigenen Identität.',
			en: 'Create multiple AI agents — each with its own name, avatar, system prompt, memory and tool policy. Agents run autonomous missions and write under their own identity.',
		},
		icon: APP_ICONS.agents,
		color: '#8b5cf6',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'beta' before release
	},
	{
		id: 'timeline',
		name: 'Timeline',
		description: {
			de: 'Was wurde wann getan',
			en: 'What happened when',
		},
		longDescription: {
			de: 'Chronologische Übersicht aller Einträge über alle Module — Tasks, Events, Kalender, KI-Missionen. Mit Akteur-Filter (User vs. KI vs. System) und Analytics-Ansicht.',
			en: 'A chronological view of every record across every module — tasks, events, calendar, AI missions. With actor filter (user / AI / system) and analytics drill-down.',
		},
		icon: APP_ICONS.timeline,
		color: '#f59e0b',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'beta' before release
	},
	{
		id: 'website',
		name: 'Website',
		description: {
			de: 'Baukasten für deine Website',
			en: 'Website builder',
		},
		longDescription: {
			de: 'Mehrseitige Websites mit einem Block-Editor bauen — Hero, Text, Galerien, Formulare — und Inhalte aus anderen Mana-Modulen (Picture-Boards, Bibliothek, News) direkt einbetten. Für Privat (Portfolio, Event-Seite) und für Firmen (Space mit mehreren Membern).',
			en: 'Build multi-page websites with a block editor — hero, text, galleries, forms — and embed content from your other Mana modules (picture boards, library, news) directly. For personal use (portfolio, event page) and for organisations (shared space with multiple members).',
		},
		icon: APP_ICONS.website,
		color: '#6366f1',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'public' before release
	},
	{
		id: 'augur',
		name: 'Augur',
		description: {
			de: 'Zeichen sammeln, Muster lesen',
			en: 'Collect signs, read patterns',
		},
		longDescription: {
			de: 'Halte Omen, Wahrsagungen und Bauchgefühle fest — und lass Mana mit der Zeit zeigen, welche deiner inneren Stimmen wirklich Recht behalten. Witness-Modus für poetisches Erfassen, Oracle-Modus für ehrliche Auswertung.',
			en: 'Capture omens, fortunes, and hunches — and over time let Mana show which of your inner voices actually get it right. Witness mode for poetic capture, Oracle mode for honest evaluation.',
		},
		icon: APP_ICONS.augur,
		color: '#7c3aed',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
	{
		id: 'spaces',
		name: 'Spaces',
		description: {
			de: 'Geteilte Bereiche & Mitglieder',
			en: 'Shared spaces & members',
		},
		longDescription: {
			de: 'Verwalte den aktiven Space und seine Mitglieder — lade Personen per E-Mail ein, vergib Rollen (Admin/Mitglied) und widerrufe offene Einladungen. Personal-Spaces zeigen nur den Hinweis, dass sie bewusst nur für dich sind; geteilte Spaces (Familie, Team, Marke, Verein, Praxis) bekommen das volle Member-Management.',
			en: 'Manage the active Space and its members — invite people by email, assign roles (admin/member) and revoke pending invitations. Personal spaces are single-user by design; shared spaces (family, team, brand, club, practice) get full member management.',
		},
		icon: APP_ICONS.spaces,
		color: '#14b8a6',
		comingSoon: false,
		status: 'beta',
		requiredTier: 'guest', // LOCAL TIER PATCH — revert to 'beta' before release
	},
	{
		id: 'wishes',
		name: 'Wünsche',
		description: {
			de: 'Wunschliste & Inspiration',
			en: 'Wishlist & inspiration',
		},
		longDescription: {
			de: 'Halte fest, was du dir wünschst — Geschenkideen, Reiseziele, Lebensziele. Ein leichter, freundlicher Ort für die Dinge, die noch keine Aufgabe sind, dich aber begleiten.',
			en: 'Capture what you wish for — gift ideas, travel destinations, life goals. A light, friendly place for the things that are not yet tasks but stay with you.',
		},
		icon: APP_ICONS.wishes,
		color: '#f59e0b',
		comingSoon: false,
		status: 'development',
		requiredTier: 'guest',
	},
];

/**
 * Get a specific app by ID
 */
export function getManaApp(id: AppIconId): ManaApp | undefined {
	return MANA_APPS.find((app) => app.id === id);
}

/**
 * Get apps filtered by status
 */
export function getManaAppsByStatus(status: AppStatus): ManaApp[] {
	return MANA_APPS.filter((app) => app.status === status);
}

/**
 * Get only published/available apps
 */
export function getAvailableManaApps(): ManaApp[] {
	return MANA_APPS.filter((app) => !app.comingSoon);
}

/**
 * Get only active (non-archived) apps
 */
export function getActiveManaApps(): ManaApp[] {
	return MANA_APPS.filter((app) => !app.archived);
}

/**
 * Get apps accessible to a user based on their tier
 * Only returns active (non-archived) apps the user has access to
 */
export function getAccessibleManaApps(userTier: string): ManaApp[] {
	return MANA_APPS.filter((app) => !app.archived && hasAppAccess(userTier, app.requiredTier));
}

/**
 * Status labels in German and English
 */
export const APP_STATUS_LABELS = {
	de: {
		published: 'Live',
		beta: 'Beta',
		development: 'In Entwicklung',
		planning: 'Geplant',
	},
	en: {
		published: 'Live',
		beta: 'Beta',
		development: 'In Development',
		planning: 'Planned',
	},
} as const;

/**
 * Common labels for AppSlider in German and English
 */
export const APP_SLIDER_LABELS = {
	de: {
		title: 'Teil des Mana Ecosystems',
		comingSoon: 'Demnächst',
		openApp: 'App öffnen',
	},
	en: {
		title: 'Part of the Mana Ecosystem',
		comingSoon: 'Coming Soon',
		openApp: 'Open App',
	},
} as const;

/**
 * App URLs — derived automatically from MANA_APPS.
 *
 * Almost every productivity app lives under the unified mana.how/{id}
 * surface, so listing each entry by hand was duplicated bookkeeping that
 * silently drifted (a missing entry crashed `getPillAppItems` at runtime
 * when the new `who` app was added). Instead we generate the map from
 * MANA_APPS at module load and only override the few apps that don't
 * follow the unified-path convention.
 *
 * To add a new app: register it in MANA_APPS and you're done. To put it
 * on its own subdomain or use a custom port: add an entry to
 * APP_URL_OVERRIDES below.
 */
const APP_URL_OVERRIDES: Partial<Record<AppIconId, { dev: string; prod: string }>> = {
	// The unified app itself lives at the root, not at /mana.
	mana: { dev: 'http://localhost:5173', prod: 'https://mana.how' },
};

export const APP_URLS: Record<AppIconId, { dev: string; prod: string }> = Object.fromEntries(
	(Object.keys(APP_ICONS) as AppIconId[]).map((id) => [
		id,
		APP_URL_OVERRIDES[id] ?? {
			dev: `http://localhost:5173/${id}`,
			prod: `https://mana.how/${id}`,
		},
	])
) as Record<AppIconId, { dev: string; prod: string }>;

/**
 * App item type for PillNavigation app switcher
 */
export interface PillAppItemConfig {
	id: string;
	name: string;
	url: string;
	icon?: string;
	color?: string;
	isCurrent?: boolean;
}

/**
 * Get app items for PillNavigation app switcher
 * Only returns apps the user has access to (non-archived, tier-gated)
 * @param currentAppId - The ID of the current app to mark as active
 * @param isDev - Whether to use development URLs (default: auto-detect)
 * @param customUrls - Optional custom URL overrides per app
 * @param userTier - The user's access tier (default: 'public')
 */
export function getPillAppItems(
	currentAppId?: AppIconId,
	isDev?: boolean,
	customUrls?: Partial<Record<AppIconId, string>>,
	userTier?: string
): PillAppItemConfig[] {
	const isDevMode =
		isDev ?? (typeof window !== 'undefined' && window.location.hostname === 'localhost');

	const tier = userTier || 'public';
	// Only show apps the user has access to
	return getAccessibleManaApps(tier).map((app) => ({
		id: app.id,
		name: app.name,
		url: customUrls?.[app.id] || (isDevMode ? APP_URLS[app.id].dev : APP_URLS[app.id].prod),
		icon: app.icon,
		color: app.color,
		isCurrent: app.id === currentAppId,
	}));
}
