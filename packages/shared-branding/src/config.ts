import type { AppBranding } from './types';

/**
 * Branding configuration for all Mana ecosystem apps.
 *
 * `satisfies` enforces each entry matches AppBranding while keeping the
 * literal keys narrow, so `keyof typeof APP_BRANDING` derives the AppId
 * union automatically.
 */
export const APP_BRANDING = {
	mana: {
		id: 'mana',
		name: 'Mana',
		tagline: 'Central Hub',
		primaryColor: '#6366f1',
		secondaryColor: '#818cf8',
		// Hexagon/Core icon
		logoPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 2,
	},
	cards: {
		id: 'cards',
		name: 'Cards',
		tagline: 'AI Flashcards',
		primaryColor: '#8b5cf6',
		secondaryColor: '#a78bfa',
		// Cards/Deck icon
		logoPath: 'M2 4h20v16H2zM6 2v2M18 2v2M6 20v2M18 20v2M2 10h20',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	chat: {
		id: 'chat',
		name: 'ManaChat',
		tagline: 'AI Chat Assistant',
		primaryColor: '#0ea5e9',
		secondaryColor: '#38bdf8',
		// Chat bubble icon
		logoPath:
			'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	presi: {
		id: 'presi',
		name: 'Presi',
		tagline: 'Presentation Creator',
		primaryColor: '#f97316',
		secondaryColor: '#fb923c',
		// Presentation/slides icon
		logoPath:
			'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	quotes: {
		id: 'quotes',
		name: 'Quotes',
		tagline: 'Daily Inspiration',
		primaryColor: '#f59e0b',
		secondaryColor: '#fbbf24',
		// Quote/chat bubble icon
		logoPath:
			'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	picture: {
		id: 'picture',
		name: 'Picture',
		tagline: 'AI Image Generation',
		primaryColor: '#3b82f6',
		secondaryColor: '#60a5fa',
		// Image/picture icon
		logoPath:
			'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	contacts: {
		id: 'contacts',
		name: 'Contacts',
		tagline: 'Contact Management',
		primaryColor: '#3b82f6',
		secondaryColor: '#60a5fa',
		// Users/contacts icon
		logoPath:
			'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	calendar: {
		id: 'calendar',
		name: 'Kalender',
		tagline: 'Smart Calendar Management',
		primaryColor: '#0ea5e9',
		secondaryColor: '#38bdf8',
		// Calendar icon
		logoPath:
			'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	mail: {
		id: 'mail',
		name: 'Mail',
		tagline: 'Smart Email Client',
		primaryColor: '#6366f1',
		secondaryColor: '#818cf8',
		// Envelope icon
		logoPath:
			'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	storage: {
		id: 'storage',
		name: 'Storage',
		tagline: 'Cloud Storage',
		primaryColor: '#3b82f6',
		secondaryColor: '#60a5fa',
		// Cloud/storage icon
		logoPath:
			'M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	clock: {
		id: 'clock',
		name: 'Clock',
		tagline: 'Clocks & Alarms',
		primaryColor: '#f59e0b',
		secondaryColor: '#fbbf24',
		// Clock icon
		logoPath: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	todo: {
		id: 'todo',
		name: 'Todo',
		tagline: 'Task Management',
		primaryColor: '#8b5cf6',
		secondaryColor: '#a78bfa',
		// Checklist icon
		logoPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	moodlit: {
		id: 'moodlit',
		name: 'Moodlit',
		tagline: 'Ambient Lighting',
		primaryColor: '#8b5cf6',
		secondaryColor: '#a78bfa',
		// Lightbulb/ambient light icon
		logoPath:
			'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	inventory: {
		id: 'inventory',
		name: 'Inventory',
		tagline: 'Inventory Management',
		primaryColor: '#14b8a6',
		secondaryColor: '#2dd4bf',
		// Box/package icon
		logoPath:
			'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	questions: {
		id: 'questions',
		name: 'Questions',
		tagline: 'AI Research Assistant',
		primaryColor: '#8b5cf6',
		secondaryColor: '#a78bfa',
		// Question mark / search icon
		logoPath:
			'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	skilltree: {
		id: 'skilltree',
		name: 'SkillTree',
		tagline: 'Level Up Your Life',
		primaryColor: '#10b981',
		secondaryColor: '#34d399',
		// Tree/branch icon representing skill progression
		logoPath:
			'M12 3v1.5M12 21v-1.5M12 9a3 3 0 100-6 3 3 0 000 6zm0 0v3m0 6a3 3 0 100-6 3 3 0 000 6zm-6-3h1.5m10.5 0h1.5M6 12a3 3 0 100-6 3 3 0 000 6zm0 0h3m6 0h3m-3 0a3 3 0 100-6 3 3 0 000 6z',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	lightwrite: {
		id: 'lightwrite',
		name: 'LightWrite',
		tagline: 'Beat & Lyrics Editor',
		primaryColor: '#f97316',
		secondaryColor: '#fb923c',
		// Musical note with waveform icon
		logoPath:
			'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
	music: {
		id: 'music',
		name: 'Music',
		tagline: 'Music Workspace',
		primaryColor: '#ec4899',
		secondaryColor: '#f472b6',
		// Music note icon
		logoPath:
			'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
		logoViewBox: '0 0 24 24',
		logoStroke: true,
		logoStrokeWidth: 1.5,
	},
} satisfies Record<string, AppBranding>;

/** Derived from `APP_BRANDING` keys — single source of truth. */
export type AppId = keyof typeof APP_BRANDING;

/**
 * Get branding config for an app
 */
export function getAppBranding(appId: AppId): AppBranding {
	return APP_BRANDING[appId];
}

/**
 * Get all app brandings
 */
export function getAllAppBrandings(): AppBranding[] {
	return Object.values(APP_BRANDING);
}
