/**
 * Picture module types for the unified Mana app.
 */

import type { BaseRecord } from '@mana/local-store';
import type { VisibilityLevel } from '@mana/shared-privacy';

/**
 * How the image was created. 'text' is the classic prompt-only
 * generation via /picture/generate; 'reference' is a multi-image edit
 * via /picture/generate-with-reference (plan M3) — the latter carries
 * `referenceImageIds` pointing at the meImages that fed the edit.
 */
export type ImageGenerationMode = 'text' | 'reference';

export interface LocalImage extends BaseRecord {
	prompt: string;
	negativePrompt?: string | null;
	model?: string | null;
	style?: string | null;
	publicUrl?: string | null;
	storagePath: string;
	filename: string;
	format?: string | null;
	width?: number | null;
	height?: number | null;
	fileSize?: number | null;
	blurhash?: string | null;
	visibility?: VisibilityLevel;
	visibilityChangedAt?: string;
	visibilityChangedBy?: string;
	unlistedToken?: string;
	isFavorite: boolean;
	downloadCount: number;
	rating?: number | null;
	isArchived?: boolean;
	generationId?: string | null;
	sourceImageId?: string | null;
	/** mana-media ids of the me-images that fed a reference-edit. */
	referenceImageIds?: string[] | null;
	generationMode?: ImageGenerationMode | null;
}

export interface LocalBoard extends BaseRecord {
	name: string;
	description?: string | null;
	thumbnailUrl?: string | null;
	canvasWidth: number;
	canvasHeight: number;
	backgroundColor: string;
	visibility?: VisibilityLevel;
	visibilityChangedAt?: string;
	visibilityChangedBy?: string;
	unlistedToken?: string;
}

export interface LocalBoardItem extends BaseRecord {
	boardId: string;
	itemType: 'image' | 'text';
	imageId?: string | null;
	textContent?: string | null;
	fontSize?: number | null;
	color?: string | null;
	positionX: number;
	positionY: number;
	scaleX: number;
	scaleY: number;
	rotation: number;
	zIndex: number;
	opacity: number;
	width?: number | null;
	height?: number | null;
	properties: Record<string, unknown>;
}

export interface LocalImageTag extends BaseRecord {
	imageId: string;
	tagId: string;
}

export type ViewMode = 'single' | 'grid3' | 'grid5';

export interface Image {
	id: string;
	prompt: string;
	negativePrompt?: string;
	model?: string;
	style?: string;
	publicUrl?: string;
	storagePath: string;
	filename: string;
	format?: string;
	width?: number;
	height?: number;
	fileSize?: number;
	blurhash?: string;
	visibility: VisibilityLevel;
	isFavorite: boolean;
	downloadCount: number;
	rating?: number;
	isArchived?: boolean;
	generationId?: string;
	sourceImageId?: string;
	referenceImageIds?: string[];
	generationMode?: ImageGenerationMode;
	createdAt: string;
	updatedAt: string;
}

export interface Board {
	id: string;
	name: string;
	description?: string;
	thumbnailUrl?: string;
	canvasWidth: number;
	canvasHeight: number;
	backgroundColor: string;
	visibility: VisibilityLevel;
	createdAt: string;
	updatedAt: string;
}

export interface BoardWithCount extends Board {
	itemCount: number;
}
