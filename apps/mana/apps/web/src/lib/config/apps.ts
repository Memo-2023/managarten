/**
 * Multi-app configuration for Mana dashboard and welcome page branding
 * Defines all apps in the Mana ecosystem with their features and styling
 */

export interface AppFeature {
	icon: string;
	title: string;
	description: string;
	color: string;
}

export interface AppConfig {
	name: string;
	displayName: string;
	tagline: string;
	description: string;
	logoEmoji?: string;
	primaryColor: string;
	accentColor: string;
	features: AppFeature[];
	dashboardRoute: string;
	website?: string;
}

/**
 * App configurations for all applications in the Mana ecosystem
 */
export const appConfigs: Record<string, AppConfig> = {
	// ============================================
	// CORE PLATFORM
	// ============================================
	mana: {
		name: 'mana',
		displayName: 'Mana',
		tagline: 'Dein Universal-Account',
		description: 'Ein Account für alle Mana-Anwendungen.',
		logoEmoji: '⚡',
		primaryColor: '#6366F1',
		accentColor: '#818CF8',
		features: [
			{
				icon: '🔐',
				title: 'Single Sign-On',
				description: 'Ein Account für alle Mana-Apps',
				color: '#6366F1',
			},
			{
				icon: '👤',
				title: 'Einheitliches Profil',
				description: 'Verwalte dein Profil an einem Ort',
				color: '#8B5CF6',
			},
			{
				icon: '🏢',
				title: 'Organisation & Teams',
				description: 'Erstelle und verwalte Teams über alle Apps',
				color: '#EC4899',
			},
			{
				icon: '💳',
				title: 'Mana Credits',
				description: 'Universelles Credit-System für alle Mana-Services',
				color: '#10B981',
			},
		],
		dashboardRoute: '/',
	},

	// ============================================
	// AI-POWERED APPS
	// ============================================
	chat: {
		name: 'chat',
		displayName: 'ManaChat',
		tagline: 'KI Chat Assistent',
		description: 'Dein intelligenter KI-Begleiter für Gespräche, Fragen und kreative Aufgaben.',
		logoEmoji: '💬',
		primaryColor: '#0EA5E9',
		accentColor: '#38BDF8',
		features: [
			{
				icon: '🤖',
				title: 'Mehrere KI-Modelle',
				description: 'Wähle zwischen verschiedenen AI-Modellen',
				color: '#0EA5E9',
			},
			{
				icon: '💬',
				title: 'Konversationsverlauf',
				description: 'Alle Chats gespeichert und durchsuchbar',
				color: '#06B6D4',
			},
			{
				icon: '📝',
				title: 'Kreatives Schreiben',
				description: 'Texte, Code und mehr generieren',
				color: '#8B5CF6',
			},
			{
				icon: '🌐',
				title: 'Mehrsprachig',
				description: 'Unterstützung für viele Sprachen',
				color: '#10B981',
			},
		],
		dashboardRoute: '/',
		website: 'https://chat.mana.how',
	},

	picture: {
		name: 'picture',
		displayName: 'ManaPicture',
		tagline: 'KI Bildgenerierung',
		description: 'Erschaffe einzigartige Bilder mit der Kraft künstlicher Intelligenz.',
		logoEmoji: '🎨',
		primaryColor: '#22C55E',
		accentColor: '#4ADE80',
		features: [
			{
				icon: '🎨',
				title: 'KI-Bildgenerierung',
				description: 'Erstelle Bilder aus Textbeschreibungen',
				color: '#22C55E',
			},
			{
				icon: '🖼️',
				title: 'Galerie',
				description: 'Alle generierten Bilder organisiert',
				color: '#10B981',
			},
			{
				icon: '✨',
				title: 'Verschiedene Stile',
				description: 'Fotorealistisch, Cartoon, Kunst und mehr',
				color: '#8B5CF6',
			},
			{
				icon: '📐',
				title: 'Flexible Formate',
				description: 'Verschiedene Größen und Seitenverhältnisse',
				color: '#F59E0B',
			},
		],
		dashboardRoute: '/',
		website: 'https://picture.mana.how',
	},

	presi: {
		name: 'presi',
		displayName: 'Presi',
		tagline: 'Präsentations-Creator',
		description: 'Erstelle beeindruckende Präsentationen mit KI-gestützten Design-Vorschlägen.',
		logoEmoji: '📊',
		primaryColor: '#F97316',
		accentColor: '#FB923C',
		features: [
			{
				icon: '📊',
				title: 'Slide-Editor',
				description: 'Intuitive Folien-Bearbeitung',
				color: '#F97316',
			},
			{
				icon: '🎨',
				title: 'Design-Vorlagen',
				description: 'Professionelle Templates',
				color: '#EC4899',
			},
			{
				icon: '✨',
				title: 'KI-Unterstützung',
				description: 'Automatische Design-Vorschläge',
				color: '#8B5CF6',
			},
			{
				icon: '📤',
				title: 'Export',
				description: 'PDF, PPTX und mehr',
				color: '#10B981',
			},
		],
		dashboardRoute: '/',
		website: 'https://presi.mana.how',
	},

	mail: {
		name: 'mail',
		displayName: 'ManaMail',
		tagline: 'Smart Email Client',
		description:
			'Intelligenter E-Mail-Client mit KI-Zusammenfassungen, Smart Reply und Multi-Account.',
		logoEmoji: '📧',
		primaryColor: '#6366F1',
		accentColor: '#818CF8',
		features: [
			{
				icon: '📧',
				title: 'Multi-Account',
				description: 'Alle E-Mail-Konten an einem Ort',
				color: '#6366F1',
			},
			{
				icon: '🤖',
				title: 'KI-Zusammenfassungen',
				description: 'Lange E-Mails auf den Punkt gebracht',
				color: '#8B5CF6',
			},
			{
				icon: '⚡',
				title: 'Smart Reply',
				description: 'KI-generierte Antwortvorschläge',
				color: '#10B981',
			},
			{
				icon: '🔍',
				title: 'Intelligente Suche',
				description: 'Finde jede E-Mail sofort',
				color: '#0EA5E9',
			},
		],
		dashboardRoute: '/',
		website: 'https://mail.mana.how',
	},

	// ============================================
	// PRODUCTIVITY APPS
	// ============================================
	cards: {
		name: 'cards',
		displayName: 'Cards',
		tagline: 'KI Karteikarten',
		description: 'Lerne intelligenter mit KI-generierten Karteikarten und Spaced Repetition.',
		logoEmoji: '🎴',
		primaryColor: '#8B5CF6',
		accentColor: '#A78BFA',
		features: [
			{
				icon: '🎴',
				title: 'Smarte Karteikarten',
				description: 'KI-generierte Lernkarten aus deinen Notizen',
				color: '#8B5CF6',
			},
			{
				icon: '🧠',
				title: 'Spaced Repetition',
				description: 'Intelligente Wiederholung für optimales Lernen',
				color: '#EC4899',
			},
			{
				icon: '📊',
				title: 'Lernfortschritt',
				description: 'Detaillierte Statistiken und Insights',
				color: '#10B981',
			},
			{
				icon: '🌍',
				title: 'Mehrsprachig',
				description: 'Lerne in jeder Sprache',
				color: '#F59E0B',
			},
		],
		dashboardRoute: '/',
		website: 'https://cardecky.mana.how',
	},

	todo: {
		name: 'todo',
		displayName: 'ManaTodo',
		tagline: 'Aufgabenverwaltung',
		description: 'Verwalte Aufgaben mit Projekten, Labels, Subtasks und wiederkehrenden Terminen.',
		logoEmoji: '✅',
		primaryColor: '#8B5CF6',
		accentColor: '#A78BFA',
		features: [
			{
				icon: '✅',
				title: 'Aufgaben',
				description: 'Erstelle und verwalte Aufgaben',
				color: '#8B5CF6',
			},
			{
				icon: '📁',
				title: 'Projekte',
				description: 'Organisiere Aufgaben in Projekten',
				color: '#10B981',
			},
			{
				icon: '🏷️',
				title: 'Labels & Tags',
				description: 'Flexible Kategorisierung',
				color: '#F59E0B',
			},
			{
				icon: '🔄',
				title: 'Wiederkehrend',
				description: 'Automatisch wiederholende Aufgaben',
				color: '#EC4899',
			},
		],
		dashboardRoute: '/',
		website: 'https://todo.mana.how',
	},

	calendar: {
		name: 'calendar',
		displayName: 'ManaCalendar',
		tagline: 'Smarte Kalenderverwaltung',
		description:
			'Organisiere deine Zeit mit persönlichen und geteilten Kalendern, wiederkehrenden Terminen und Erinnerungen.',
		logoEmoji: '📅',
		primaryColor: '#0EA5E9',
		accentColor: '#38BDF8',
		features: [
			{
				icon: '📅',
				title: 'Kalender',
				description: 'Persönliche und geteilte Kalender',
				color: '#0EA5E9',
			},
			{
				icon: '🔄',
				title: 'Wiederkehrende Termine',
				description: 'Flexible Wiederholungsmuster',
				color: '#10B981',
			},
			{
				icon: '🔔',
				title: 'Erinnerungen',
				description: 'Verpasse keinen Termin',
				color: '#F59E0B',
			},
			{
				icon: '🔗',
				title: 'CalDAV/iCal Sync',
				description: 'Synchronisiere mit anderen Apps',
				color: '#8B5CF6',
			},
		],
		dashboardRoute: '/',
		website: 'https://calendar.mana.how',
	},

	contacts: {
		name: 'contacts',
		displayName: 'Kontakte',
		tagline: 'Kontaktverwaltung',
		description: 'Verwalte deine Kontakte übersichtlich mit Gruppen, Tags und Notizen.',
		logoEmoji: '👥',
		primaryColor: '#3B82F6',
		accentColor: '#60A5FA',
		features: [
			{
				icon: '👥',
				title: 'Kontakte',
				description: 'Alle Kontakte an einem Ort',
				color: '#3B82F6',
			},
			{
				icon: '🏷️',
				title: 'Gruppen & Tags',
				description: 'Flexible Organisation',
				color: '#10B981',
			},
			{
				icon: '📥',
				title: 'Import/Export',
				description: 'VCF, CSV und mehr',
				color: '#F59E0B',
			},
			{
				icon: '🔄',
				title: 'Google Sync',
				description: 'Synchronisiere mit Google Contacts',
				color: '#EC4899',
			},
		],
		dashboardRoute: '/',
		website: 'https://contacts.mana.how',
	},

	finance: {
		name: 'finance',
		displayName: 'ManaFinance',
		tagline: 'Budget-Tracker & Finanzübersicht',
		description:
			'Behalte deine Finanzen im Blick mit Multi-Currency-Konten, Transaktionen und Budgets.',
		logoEmoji: '💰',
		primaryColor: '#10B981',
		accentColor: '#34D399',
		features: [
			{
				icon: '💰',
				title: 'Konten',
				description: 'Verwalte mehrere Konten',
				color: '#10B981',
			},
			{
				icon: '💳',
				title: 'Transaktionen',
				description: 'Erfasse Ein- und Ausgaben',
				color: '#3B82F6',
			},
			{
				icon: '📊',
				title: 'Budgets',
				description: 'Setze Limits und behalte den Überblick',
				color: '#F59E0B',
			},
			{
				icon: '🌍',
				title: 'Multi-Currency',
				description: 'Unterstützung für alle Währungen',
				color: '#8B5CF6',
			},
		],
		dashboardRoute: '/',
		website: 'https://finance.mana.how',
	},

	// ============================================
	// UTILITY APPS
	// ============================================
	// clock: consolidated into times

	quotes: {
		name: 'quotes',
		displayName: 'Quotes',
		tagline: 'Tägliche Inspiration',
		description: 'Entdecke inspirierende Zitate und Weisheiten für jeden Tag.',
		logoEmoji: '💡',
		primaryColor: '#F59E0B',
		accentColor: '#FBBF24',
		features: [
			{
				icon: '💡',
				title: 'Tägliche Zitate',
				description: 'Jeden Tag neue Inspiration',
				color: '#F59E0B',
			},
			{
				icon: '❤️',
				title: 'Favoriten',
				description: 'Speichere deine Lieblingszitate',
				color: '#EF4444',
			},
			{
				icon: '🎯',
				title: 'Personalisiert',
				description: 'Zitate nach deinem Geschmack',
				color: '#8B5CF6',
			},
			{
				icon: '📤',
				title: 'Teilen',
				description: 'Teile Zitate mit Freunden',
				color: '#10B981',
			},
		],
		dashboardRoute: '/',
		website: 'https://quotes.mana.how',
	},

	storage: {
		name: 'storage',
		displayName: 'ManaStorage',
		tagline: 'Cloud-Speicherung',
		description: 'Sichere Cloud-Speicherung für deine Dateien mit Ordnern, Sharing und mehr.',
		logoEmoji: '☁️',
		primaryColor: '#3B82F6',
		accentColor: '#60A5FA',
		features: [
			{
				icon: '☁️',
				title: 'Cloud-Speicher',
				description: 'Deine Dateien sicher in der Cloud',
				color: '#3B82F6',
			},
			{
				icon: '📁',
				title: 'Ordner',
				description: 'Organisiere deine Dateien',
				color: '#10B981',
			},
			{
				icon: '🔗',
				title: 'Sharing',
				description: 'Teile Dateien mit anderen',
				color: '#8B5CF6',
			},
			{
				icon: '📱',
				title: 'Überall verfügbar',
				description: 'Zugriff von jedem Gerät',
				color: '#F59E0B',
			},
		],
		dashboardRoute: '/',
		website: 'https://storage.mana.how',
	},
};

/**
 * Default Mana branding for the platform overview
 */
export const defaultManaConfig: AppConfig = {
	name: 'mana',
	displayName: 'Mana',
	tagline: 'Die einheitliche App-Plattform',
	description:
		'Greife auf alle Mana-Apps mit einem einzigen Account zu. Gebaut für Produktivität, angetrieben von KI.',
	logoEmoji: '⚡',
	primaryColor: '#6366F1',
	accentColor: '#818CF8',
	features: [
		{
			icon: '💬',
			title: 'ManaChat',
			description: 'KI-Chat mit verschiedenen Modellen',
			color: '#0EA5E9',
		},
		{
			icon: '🎨',
			title: 'ManaPicture',
			description: 'KI-Bildgenerierung',
			color: '#22C55E',
		},
		{
			icon: '🎴',
			title: 'Cards',
			description: 'Intelligente Lernkarten',
			color: '#8B5CF6',
		},
		{
			icon: '📅',
			title: 'ManaCalendar',
			description: 'Smarte Kalenderverwaltung',
			color: '#0EA5E9',
		},
		{
			icon: '✅',
			title: 'ManaTodo',
			description: 'Aufgabenverwaltung mit Projekten',
			color: '#8B5CF6',
		},
		{
			icon: '💡',
			title: 'Quotes',
			description: 'Tägliche Inspiration',
			color: '#F59E0B',
		},
	],
	dashboardRoute: '/',
};

/**
 * Get app configuration by app name
 * Returns default Mana config if app not found
 */
export function getAppConfig(appName?: string | null): AppConfig {
	if (!appName) {
		return defaultManaConfig;
	}

	const normalizedName = appName.toLowerCase().trim();
	return appConfigs[normalizedName] || defaultManaConfig;
}

/**
 * Get all active app configurations
 */
export function getAllAppConfigs(): AppConfig[] {
	return Object.values(appConfigs);
}

/**
 * Get app configurations by category
 */
export function getAppsByCategory(): {
	core: AppConfig[];
	ai: AppConfig[];
	productivity: AppConfig[];
	utility: AppConfig[];
} {
	return {
		core: [appConfigs.mana],
		ai: [appConfigs.chat, appConfigs.picture, appConfigs.presi, appConfigs.mail],
		productivity: [
			appConfigs.cards,
			appConfigs.todo,
			appConfigs.calendar,
			appConfigs.contacts,
			appConfigs.finance,
		],
		utility: [appConfigs.clock, appConfigs.quotes, appConfigs.storage],
	};
}
