/**
 * Upload an image or audio file to mana-media and get back a media id
 * + a public URL ready to drop into a card field.
 *
 * Resolves the media base URL from window.__PUBLIC_MANA_MEDIA_URL__
 * (injected by hooks.server.ts) so the same code works in dev (when
 * mana-media runs on localhost) and prod (https://media.mana.how).
 *
 * 25 MB hard-cap mirrors the website-upload pattern in mana-web.
 */

const MAX_BYTES = 25 * 1024 * 1024;

export class MediaUploadError extends Error {
	constructor(
		message: string,
		public status?: number
	) {
		super(message);
		this.name = 'MediaUploadError';
	}
}

function mediaBaseUrl(): string {
	if (typeof window !== 'undefined') {
		const fromWindow = (window as unknown as { __PUBLIC_MANA_MEDIA_URL__?: string })
			.__PUBLIC_MANA_MEDIA_URL__;
		if (fromWindow) return fromWindow.replace(/\/$/, '');
	}
	return 'http://localhost:3015';
}

export interface UploadedMedia {
	id: string;
	url: string;
	kind: 'image' | 'audio' | 'video' | 'other';
}

function classify(mime: string): UploadedMedia['kind'] {
	if (mime.startsWith('image/')) return 'image';
	if (mime.startsWith('audio/')) return 'audio';
	if (mime.startsWith('video/')) return 'video';
	return 'other';
}

export async function uploadCardMedia(file: File): Promise<UploadedMedia> {
	if (file.size > MAX_BYTES) {
		throw new MediaUploadError(`Datei zu groß (max ${MAX_BYTES / 1024 / 1024} MB).`, 400);
	}
	const kind = classify(file.type);
	if (kind === 'other') {
		throw new MediaUploadError('Nur Bilder, Audio oder Video werden unterstützt.', 400);
	}

	const formData = new FormData();
	formData.append('file', file);
	formData.append('app', 'cards');

	const res = await fetch(`${mediaBaseUrl()}/api/v1/media/upload`, {
		method: 'POST',
		body: formData,
	});
	if (!res.ok) {
		throw new MediaUploadError(`Upload fehlgeschlagen (${res.status})`, res.status);
	}
	const data = (await res.json()) as { id?: string };
	if (!data.id) throw new MediaUploadError('Upload-Antwort ohne Media-ID.', 500);

	const variant = kind === 'image' ? '/file/medium' : '/file';
	return {
		id: data.id,
		url: `${mediaBaseUrl()}/api/v1/media/${data.id}${variant}`,
		kind,
	};
}

/** Snippet to drop into a card field. Markdown for images, raw HTML for
 *  audio/video so the user can also tweak attributes by hand later. */
export function mediaToFieldSnippet(media: UploadedMedia, label: string): string {
	switch (media.kind) {
		case 'image':
			return `![${label}](${media.url})`;
		case 'audio':
			return `<audio controls preload="metadata" src="${media.url}"></audio>`;
		case 'video':
			return `<video controls preload="metadata" src="${media.url}"></video>`;
		default:
			return media.url;
	}
}
