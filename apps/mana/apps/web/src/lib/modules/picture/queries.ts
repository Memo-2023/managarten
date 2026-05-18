/**
 * Reactive Queries & Pure Helpers for Picture module.
 *
 * Uses Dexie liveQuery to automatically re-render when IndexedDB changes
 * (local writes, sync updates, other tabs). Components call these hooks
 * at init time; no manual fetch/refresh needed.
 */

import { liveQuery } from 'dexie';
import { deriveUpdatedAt } from '$lib/data/sync';
import { useScopedLiveQuery } from '$lib/data/scope/use-scoped-live-query.svelte';
import { db } from '$lib/data/database';
import { scopedForModule } from '$lib/data/scope';
import { decryptRecords } from '$lib/data/crypto';
import type {
	LocalImage,
	LocalBoard,
	LocalBoardItem,
	LocalImageTag,
	Image,
	Board,
	BoardWithCount,
} from './types';

// ─── Type Converters ──────────────────────────────────────

export function toImage(local: LocalImage): Image {
	return {
		id: local.id,
		prompt: local.prompt,
		negativePrompt: local.negativePrompt ?? undefined,
		model: local.model ?? undefined,
		style: local.style ?? undefined,
		publicUrl: local.publicUrl ?? undefined,
		storagePath: local.storagePath,
		filename: local.filename,
		format: local.format ?? undefined,
		width: local.width ?? undefined,
		height: local.height ?? undefined,
		fileSize: local.fileSize ?? undefined,
		blurhash: local.blurhash ?? undefined,
		visibility: local.visibility ?? 'private',
		isFavorite: local.isFavorite,
		downloadCount: local.downloadCount,
		rating: local.rating ?? undefined,
		isArchived: local.isArchived ?? undefined,
		generationId: local.generationId ?? undefined,
		sourceImageId: local.sourceImageId ?? undefined,
		referenceImageIds: local.referenceImageIds ?? undefined,
		generationMode: local.generationMode ?? undefined,
		comicStoryId: local.comicStoryId ?? undefined,
		comicPanelIndex: local.comicPanelIndex ?? undefined,
		comicCharacterId: local.comicCharacterId ?? undefined,
		createdAt: local.createdAt ?? new Date().toISOString(),
		updatedAt: deriveUpdatedAt(local),
	};
}

export function toBoard(local: LocalBoard): Board {
	return {
		id: local.id,
		name: local.name,
		description: local.description ?? undefined,
		thumbnailUrl: local.thumbnailUrl ?? undefined,
		canvasWidth: local.canvasWidth,
		canvasHeight: local.canvasHeight,
		backgroundColor: local.backgroundColor,
		visibility: local.visibility ?? 'private',
		createdAt: local.createdAt ?? new Date().toISOString(),
		updatedAt: deriveUpdatedAt(local),
	};
}

// ─── Svelte 5 Reactive Hooks (call during component init) ──

/** All non-archived images, sorted by createdAt desc. */
export function useAllImages() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalImage, string>('picture', 'images').toArray();
		const visible = locals.filter((img) => !img.isArchived && !img.deletedAt);
		const decrypted = await decryptRecords('images', visible);
		return decrypted
			.map(toImage)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}, [] as Image[]);
}

/** All archived images, sorted by createdAt desc. */
export function useArchivedImages() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalImage, string>('picture', 'images').toArray();
		const visible = locals.filter((img) => !!img.isArchived && !img.deletedAt);
		const decrypted = await decryptRecords('images', visible);
		return decrypted
			.map(toImage)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}, [] as Image[]);
}

/** All boards with item counts, sorted by updatedAt desc. */
export function useAllBoards() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalBoard, string>('picture', 'boards').toArray();
		const allItems = await scopedForModule<LocalBoardItem, string>(
			'picture',
			'boardItems'
		).toArray();

		// boardItems.textContent is encrypted but the count map only
		// looks at structural fields (deletedAt + boardId), so no
		// decrypt needed for the counter.
		const itemCounts = new Map<string, number>();
		for (const item of allItems) {
			if (!item.deletedAt) {
				itemCounts.set(item.boardId, (itemCounts.get(item.boardId) || 0) + 1);
			}
		}

		const visible = locals.filter((b) => !b.deletedAt);
		// boards.name + description are encrypted on disk; the workbench
		// + dashboard widgets render them, so decrypt before mapping.
		const decrypted = await decryptRecords('boards', visible);

		return decrypted
			.map(
				(local): BoardWithCount => ({
					...toBoard(local),
					itemCount: itemCounts.get(local.id) || 0,
				})
			)
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	}, [] as BoardWithCount[]);
}

// Tags: use shared global tags from @mana/shared-stores
export { useAllTags as useAllPictureTags } from '@mana/shared-stores';

/** All image-tag associations. */
export function useAllImageTags() {
	return useScopedLiveQuery(async () => {
		return await scopedForModule<LocalImageTag, string>('picture', 'imageTags').toArray();
	}, [] as LocalImageTag[]);
}

// ─── Raw Observable Queries ────────────────────────────────

export function allImages$() {
	return liveQuery(async () => {
		const locals = await scopedForModule<LocalImage, string>('picture', 'images').toArray();
		const visible = locals.filter((img) => !img.isArchived && !img.deletedAt);
		const decrypted = await decryptRecords('images', visible);
		return decrypted
			.map(toImage)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	});
}

export function allBoards$() {
	return liveQuery(async () => {
		const locals = await scopedForModule<LocalBoard, string>('picture', 'boards').toArray();
		const visible = locals.filter((b) => !b.deletedAt);
		const decrypted = await decryptRecords('boards', visible);
		return decrypted.map(toBoard);
	});
}

// ─── Pure Helper Functions (for $derived) ─────────────────

/** Filter images by favorites only. */
export function getFavoriteImages(images: Image[]): Image[] {
	return images.filter((img) => img.isFavorite);
}

/** Filter images by tag IDs using image-tag associations. */
export function getImagesByTags(
	images: Image[],
	imageTags: { imageId: string; tagId: string }[],
	selectedTagIds: string[]
): Image[] {
	if (selectedTagIds.length === 0) return images;
	const imageIdsWithTags = new Set(
		imageTags.filter((it) => selectedTagIds.includes(it.tagId)).map((it) => it.imageId)
	);
	return images.filter((img) => imageIdsWithTags.has(img.id));
}

/** Find an image by ID. */
export function findImageById(images: Image[], id: string): Image | undefined {
	return images.find((img) => img.id === id);
}

/** Find a board by ID. */
export function findBoardById(boards: BoardWithCount[], id: string): BoardWithCount | undefined {
	return boards.find((b) => b.id === id);
}
