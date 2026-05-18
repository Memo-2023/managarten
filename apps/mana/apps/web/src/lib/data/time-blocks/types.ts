/**
 * Unified Time Model — TimeBlock types.
 *
 * A TimeBlock represents any time interval across all modules.
 * Domain-specific data stays on each module's tables; the TimeBlock
 * owns the time dimension (start, end, recurrence, live status).
 */

import type { BaseRecord } from '@mana/local-store';

// ─── Enums ───────────────────────────────────────────────

export type TimeBlockKind = 'scheduled' | 'logged';

export type TimeBlockType =
	| 'event'
	| 'task'
	| 'habit'
	| 'timeEntry'
	| 'focus'
	| 'break'
	| 'body'
	| 'watering'
	| 'sleep'
	| 'practice'
	| 'period'
	| 'guide'
	| 'visit'
	| 'study'
	| 'listening'
	| 'mood'
	| 'rehearsal';

export type TimeBlockSourceModule =
	| 'calendar'
	| 'todo'
	| 'times'
	| 'habits'
	| 'events'
	| 'body'
	| 'plants'
	| 'dreams'
	| 'skilltree'
	| 'period'
	| 'guides'
	| 'places'
	| 'cards'
	| 'music'
	| 'presi';

// ─── Local Record Types (Dexie) ──────────────────────────

export interface LocalTimeBlock extends BaseRecord {
	// Time
	startDate: string; // ISO — always set
	endDate: string | null; // ISO — null = point-event or live timer
	allDay: boolean;
	isLive: boolean; // timer/tracking currently running
	timezone?: string | null;
	recurrenceRule?: string | null;

	// Classification
	kind: TimeBlockKind;
	type: TimeBlockType;

	// Link to source module
	sourceModule: TimeBlockSourceModule;
	sourceId: string;
	linkedBlockId?: string | null; // scheduled → logged link

	// Recurrence instance fields
	parentBlockId?: string | null; // ID of the recurring "template" block
	recurrenceDate?: string | null; // YYYY-MM-DD this instance represents
	isRecurrenceException?: boolean; // user manually edited this instance

	// Display (denormalized for calendar rendering without joins)
	title: string;
	description?: string | null;
	color?: string | null;
	icon?: string | null;
	projectId?: string | null;
}

export interface LocalTimeBlockTag extends BaseRecord {
	blockId: string;
	tagId: string;
}

// ─── Domain Types (returned by queries, used by UI) ──────

export interface TimeBlock {
	id: string;
	startDate: string;
	endDate: string | null;
	allDay: boolean;
	isLive: boolean;
	timezone: string | null;
	recurrenceRule: string | null;
	kind: TimeBlockKind;
	type: TimeBlockType;
	sourceModule: TimeBlockSourceModule;
	sourceId: string;
	linkedBlockId: string | null;
	parentBlockId: string | null;
	recurrenceDate: string | null;
	isRecurrenceException: boolean;
	title: string;
	description: string | null;
	color: string | null;
	icon: string | null;
	projectId: string | null;
	createdAt: string;
	updatedAt: string;
}

// ─── Input Types ─────────────────────────────────────────

export interface CreateTimeBlockInput {
	startDate: string;
	endDate?: string | null;
	allDay?: boolean;
	isLive?: boolean;
	timezone?: string | null;
	recurrenceRule?: string | null;
	kind: TimeBlockKind;
	type: TimeBlockType;
	sourceModule: TimeBlockSourceModule;
	sourceId: string;
	linkedBlockId?: string | null;
	title: string;
	description?: string | null;
	color?: string | null;
	icon?: string | null;
	projectId?: string | null;
}

export interface UpdateTimeBlockInput {
	startDate?: string;
	endDate?: string | null;
	allDay?: boolean;
	isLive?: boolean;
	timezone?: string | null;
	recurrenceRule?: string | null;
	linkedBlockId?: string | null;
	title?: string;
	description?: string | null;
	color?: string | null;
	icon?: string | null;
	projectId?: string | null;
}
