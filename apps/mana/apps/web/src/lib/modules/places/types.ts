/**
 * Places module types for the unified app.
 */

import type { BaseRecord } from '@mana/local-store';
import type { VisibilityLevel } from '@mana/shared-privacy';

export type PlaceCategory = 'home' | 'work' | 'shopping' | 'transit' | 'leisure' | 'other';

export interface LocalPlace extends BaseRecord {
	name: string;
	description?: string;
	latitude: number;
	longitude: number;
	address?: string;
	category?: PlaceCategory;
	isFavorite?: boolean;
	isArchived?: boolean;
	visitCount?: number;
	lastVisitedAt?: string;
	tagIds?: string[];
	visibility?: VisibilityLevel;
	visibilityChangedAt?: string;
	visibilityChangedBy?: string;
	unlistedToken?: string;
	/** ISO timestamp when the unlisted snapshot expires; absent = never. */
	unlistedExpiresAt?: string;
}

export interface LocalLocationLog extends BaseRecord {
	latitude: number;
	longitude: number;
	accuracy?: number;
	altitude?: number;
	speed?: number;
	heading?: number;
	timestamp: string;
	placeId?: string;
}

// ─── Shared Place Type ──────────────────────────────────

export interface Place {
	id: string;
	name: string;
	description: string | null;
	latitude: number;
	longitude: number;
	address: string | null;
	category: PlaceCategory;
	isFavorite: boolean;
	isArchived: boolean;
	visitCount: number;
	lastVisitedAt: string | null;
	tagIds: string[];
	visibility: VisibilityLevel;
	/** Server-issued share token. Empty when not 'unlisted'. */
	unlistedToken: string;
	/** ISO timestamp when the unlisted snapshot expires, or null = never. */
	unlistedExpiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface LocationLog {
	id: string;
	latitude: number;
	longitude: number;
	accuracy: number | null;
	altitude: number | null;
	speed: number | null;
	heading: number | null;
	timestamp: string;
	placeId: string | null;
}
