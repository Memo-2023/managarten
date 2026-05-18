/**
 * Public-Wire-Types für Cross-App-Share-via-uLoad.
 *
 * `UloadLink` (interne Dexie-Repräsentation) ist mit der Federation-
 * Migration 2026-05-18 entfallen — Caller arbeiten nur noch mit
 * `CreateShortLinkOptions` + `CreatedLink`.
 */

export interface CreateShortLinkOptions {
	url: string;
	title?: string;
	customCode?: string;
	source: string;
	tags?: string[];
	expiresAt?: string;
	password?: string;
	description?: string;
}

export interface CreatedLink {
	id: string;
	shortCode: string;
	shortUrl: string;
	qrCodeUrl: string;
}

export type AppSource =
	| 'calendar'
	| 'contacts'
	| 'todo'
	| 'chat'
	| 'storage'
	| 'presi'
	| 'music'
	| 'cards'
	| 'picture'
	| 'uload'
	| 'mana'
	| (string & {});

export const APP_SOURCE_LABELS: Record<string, string> = {
	calendar: 'Kalender',
	contacts: 'Kontakte',
	todo: 'Todo',
	chat: 'Chat',
	storage: 'Storage',
	presi: 'Presi',
	music: 'Music',
	cards: 'Cards',
	picture: 'Picture',
	uload: 'uLoad',
	mana: 'Mana',
};
