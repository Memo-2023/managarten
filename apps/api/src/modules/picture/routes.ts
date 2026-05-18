/**
 * Picture module — AI image generation + upload
 * Ported from apps/picture/apps/server
 *
 * CRUD for images/boards/boardItems handled by mana-sync.
 * This module handles Replicate API, S3 uploads, and explore.
 */

import { Hono } from 'hono';
import { consumeCredits, validateCredits } from '@mana/shared-hono/credits';
import type { AuthVariables } from '@mana/shared-hono';

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || '';
const IMAGE_GEN_URL = process.env.MANA_IMAGE_GEN_URL || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
// Gemini uses API-key auth against generativelanguage.googleapis.com; the
// same AIza... key works for the Nano Banana (gemini-*-image) family.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

// Credit cost by model × quality. Rough proportionality to upstream
// pricing at 1 credit ≈ $0.008. OpenAI gpt-image-* billed $0.006 / $0.053
// / $0.211 per 1024² image for low/medium/high. Google Nano Banana:
// 2.5-flash-image $0.039, 3.1-flash-image-preview $0.045, 3-pro-image-
// preview $0.134. Gemini doesn't expose quality tiers — quality input is
// ignored and the tier is chosen by model id. Flux/local legacy stays
// at a flat 10.
function creditsFor(model: string | undefined, quality: string | undefined): number {
	if (model?.startsWith('openai/')) {
		if (quality === 'low') return 3;
		if (quality === 'high') return 25;
		return 10; // medium / auto
	}
	if (model?.startsWith('google/')) {
		const id = model.slice('google/'.length);
		if (id === 'gemini-3-pro-image-preview') return 18;
		if (id === 'gemini-3.1-flash-image-preview') return 6;
		if (id === 'gemini-2.5-flash-image') return 5;
		return 10;
	}
	return 10;
}

type OpenAiSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
function resolveOpenAiSize(width?: number, height?: number): OpenAiSize {
	if (!width || !height) return '1024x1024';
	const landscape = width > height;
	const portrait = height > width;
	if (landscape) return '1536x1024';
	if (portrait) return '1024x1536';
	return '1024x1024';
}

const routes = new Hono<{ Variables: AuthVariables }>();

// ─── AI Image Generation (server-only: Replicate/local/OpenAI) ─────

routes.post('/generate', async (c) => {
	const userId = c.get('userId');
	const { prompt, model, width, height, negativePrompt, steps, guidanceScale, quality, n } =
		await c.req.json();

	if (!prompt) return c.json({ error: 'prompt required' }, 400);

	// Batch count. OpenAI gpt-image-2 supports up to 8; we clamp to 4 to stay
	// well under Tier-1 IPM limits and cap credit exposure on accidental max-n.
	// Non-OpenAI paths ignore this (Replicate/local produce a single image).
	const batchCount = Math.max(1, Math.min(4, Number(n) || 1));
	const effectiveBatch = model?.startsWith('openai/') ? batchCount : 1;
	const cost = creditsFor(model, quality) * effectiveBatch;
	const validation = await validateCredits(userId, 'AI_IMAGE_GENERATION', cost);
	if (!validation.hasCredits) {
		return c.json({ error: 'Insufficient credits', required: cost }, 402);
	}

	try {
		const imageUrls: string[] = [];
		const imageBuffers: ArrayBuffer[] = [];

		if (model?.startsWith('openai/') && OPENAI_API_KEY) {
			// OpenAI gpt-image-2 — returns base64, not URL, supports n > 1
			const openaiModel = model.slice('openai/'.length) || 'gpt-image-2';
			const res = await fetch('https://api.openai.com/v1/images/generations', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${OPENAI_API_KEY}`,
				},
				body: JSON.stringify({
					model: openaiModel,
					prompt,
					size: resolveOpenAiSize(width, height),
					quality: quality || 'medium',
					n: effectiveBatch,
				}),
			});
			if (!res.ok) {
				const detail = await res.text().catch(() => '');
				return c.json({ error: 'OpenAI image API failed', detail: detail.slice(0, 500) }, 502);
			}
			const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
			const blobs = (data.data ?? []).map((d) => d.b64_json).filter((b): b is string => !!b);
			if (blobs.length === 0) return c.json({ error: 'OpenAI returned no image data' }, 502);
			for (const b64 of blobs) {
				const binary = Buffer.from(b64, 'base64');
				imageBuffers.push(
					binary.buffer.slice(
						binary.byteOffset,
						binary.byteOffset + binary.byteLength
					) as ArrayBuffer
				);
			}
		} else if (model?.startsWith('local/') && IMAGE_GEN_URL) {
			// Local generation via mana-image-gen
			const res = await fetch(`${IMAGE_GEN_URL}/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt,
					negative_prompt: negativePrompt,
					width: width || 1024,
					height: height || 1024,
					steps: steps || 20,
					guidance_scale: guidanceScale || 7.5,
				}),
			});
			if (!res.ok) return c.json({ error: 'Local generation failed' }, 502);
			const data = await res.json();
			const localUrl = data.image_url || data.url;
			if (localUrl) imageUrls.push(localUrl);
		} else if (REPLICATE_TOKEN) {
			// Cloud generation via Replicate
			const res = await fetch('https://api.replicate.com/v1/predictions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${REPLICATE_TOKEN}`,
				},
				body: JSON.stringify({
					model: model || 'black-forest-labs/flux-schnell',
					input: {
						prompt,
						negative_prompt: negativePrompt,
						width: width || 1024,
						height: height || 1024,
						num_inference_steps: steps || 4,
						guidance_scale: guidanceScale || 0,
					},
				}),
			});
			if (!res.ok) return c.json({ error: 'Replicate API failed' }, 502);

			const prediction = await res.json();

			// Poll for completion
			let output = prediction.output;
			if (!output && prediction.urls?.get) {
				for (let i = 0; i < 60; i++) {
					await new Promise((r) => setTimeout(r, 2000));
					const pollRes = await fetch(prediction.urls.get, {
						headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
					});
					const pollData = await pollRes.json();
					if (pollData.status === 'succeeded') {
						output = pollData.output;
						break;
					}
					if (pollData.status === 'failed') {
						return c.json({ error: 'Generation failed' }, 500);
					}
				}
			}

			const replicateUrl = Array.isArray(output) ? output[0] : output;
			if (replicateUrl) imageUrls.push(replicateUrl);
		} else {
			return c.json({ error: 'No image generation service configured' }, 503);
		}

		const producedCount = imageBuffers.length + imageUrls.length;
		if (producedCount === 0) return c.json({ error: 'Generation produced no image' }, 502);

		await consumeCredits(userId, 'AI_IMAGE_GENERATION', cost, `Image: ${prompt.slice(0, 50)}`);

		// Store each generated image in mana-media for dedup, thumbnails & Photos gallery.
		// OpenAI contributed pre-decoded buffers; Replicate/local contributed URLs to fetch.
		try {
			const { uploadImageToMedia } = await import('../../lib/media');
			const images: Array<{ imageUrl: string; mediaId: string; thumbnailUrl?: string }> = [];
			const ts = Date.now();
			let idx = 0;
			for (const buf of imageBuffers) {
				const media = await uploadImageToMedia(buf, `generated-${ts}-${idx}.png`, {
					app: 'picture',
					userId,
				});
				images.push({
					imageUrl: media.urls.original,
					mediaId: media.id,
					thumbnailUrl: media.urls.thumbnail,
				});
				idx++;
			}
			for (const url of imageUrls) {
				const imgRes = await fetch(url);
				const imgBuffer = await imgRes.arrayBuffer();
				const media = await uploadImageToMedia(imgBuffer, `generated-${ts}-${idx}.png`, {
					app: 'picture',
					userId,
				});
				images.push({
					imageUrl: media.urls.original,
					mediaId: media.id,
					thumbnailUrl: media.urls.thumbnail,
				});
				idx++;
			}

			return c.json({
				images,
				prompt,
				model: model || 'flux-schnell',
				// Back-compat: first image exposed at top level too.
				imageUrl: images[0]?.imageUrl,
				mediaId: images[0]?.mediaId,
				thumbnailUrl: images[0]?.thumbnailUrl,
			});
		} catch {
			// Fallback: return raw imageUrls if mana-media is unavailable. OpenAI's
			// base64-only path has no fallback URL — surface an error instead.
			if (imageUrls.length === 0) return c.json({ error: 'Media upload failed' }, 502);
			return c.json({
				images: imageUrls.map((u) => ({ imageUrl: u })),
				imageUrl: imageUrls[0],
				prompt,
				model: model || 'flux-schnell',
			});
		}
	} catch (_err) {
		return c.json({ error: 'Generation failed' }, 500);
	}
});

// ─── Reference-based Image Edits (OpenAI /v1/images/edits) ─────────
//
// Takes 1..MAX_REFERENCE_IMAGES media ids from the caller (expected to
// come from meImages — plan M1, filtered by usage.aiReference=true on
// the client), verifies ownership under the `me` app-tag, downloads the
// raw bytes from mana-media, and forwards a multipart POST to OpenAI's
// `/v1/images/edits`. Generated outputs are pushed back into mana-media
// under app='picture' so the Dexie picture-store can pin them exactly
// like a text-to-image result.
//
// Only gpt-image-1 / gpt-image-2 are wired here — they accept multi-
// image input natively. Replicate/local fallback is a later milestone.

// OpenAI gpt-image-1 / gpt-image-2 accept up to 16 reference images per
// edit call. We clamp at 8 to keep credit exposure and upload payload
// size predictable.
const MAX_REFERENCE_IMAGES = 8;

routes.post('/generate-with-reference', async (c) => {
	const userId = c.get('userId');
	const body = (await c.req.json()) as {
		prompt?: string;
		referenceMediaIds?: string[];
		model?: string;
		quality?: string;
		size?: OpenAiSize;
		n?: number;
	};

	const prompt = (body.prompt ?? '').trim();
	if (!prompt) return c.json({ error: 'prompt required' }, 400);

	const refIds = Array.isArray(body.referenceMediaIds)
		? body.referenceMediaIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
		: [];
	if (refIds.length === 0) return c.json({ error: 'referenceMediaIds required' }, 400);
	if (refIds.length > MAX_REFERENCE_IMAGES) {
		return c.json(
			{ error: `Too many references (max ${MAX_REFERENCE_IMAGES})`, limit: MAX_REFERENCE_IMAGES },
			400
		);
	}

	const model = body.model ?? 'openai/gpt-image-2';
	// Two edit providers wired today: OpenAI's gpt-image-1/2 (openai/)
	// and Google's Nano Banana family (google/) — Gemini 2.5 Flash Image,
	// 3.1 Flash Image Preview, 3 Pro Image Preview. Everything else
	// (Replicate, local FLUX+PuLID) is not supported for multi-ref edits.
	const isOpenAi = model.startsWith('openai/');
	const isGoogle = model.startsWith('google/');
	if (!isOpenAi && !isGoogle) {
		return c.json({ error: `Model ${model} not supported for edits`, model }, 400);
	}
	if (isOpenAi && !OPENAI_API_KEY) {
		return c.json({ error: 'OpenAI image edits not configured' }, 503);
	}
	if (isGoogle && !GEMINI_API_KEY) {
		return c.json({ error: 'Google Gemini image edits not configured' }, 503);
	}
	const openaiModel = isOpenAi ? model.slice('openai/'.length) || 'gpt-image-2' : '';
	const googleModel = isGoogle ? model.slice('google/'.length) || 'gemini-3-pro-image-preview' : '';
	const quality = (body.quality as 'low' | 'medium' | 'high' | undefined) ?? 'medium';
	const size: OpenAiSize = body.size ?? '1024x1024';
	const effectiveBatch = Math.max(1, Math.min(4, Number(body.n) || 1));

	// Credits: same per-output tarif as /generate. References don't add
	// a surcharge — OpenAI doesn't bill extra for input images, so we
	// don't either (plan decision #4).
	const cost = creditsFor(model, quality) * effectiveBatch;
	const validation = await validateCredits(userId, 'AI_IMAGE_GENERATION', cost);
	if (!validation.hasCredits) {
		return c.json({ error: 'Insufficient credits', required: cost }, 402);
	}

	// Ownership check before we spend credits or burn OpenAI quota.
	// Currently only `me` (face/body portraits from the profile module)
	// is a valid upload tag — anything else is treated as not-owned
	// regardless of mana-media's own view.
	try {
		const { verifyMediaOwnership } = await import('../../lib/media');
		await verifyMediaOwnership(userId, refIds, ['me']);
	} catch (err) {
		const e = err as Error & { status?: number; missing?: string[] };
		if (e.status === 404) {
			return c.json({ error: 'Reference media not found', missing: e.missing }, 404);
		}
		console.error('[picture/generate-with-reference] ownership check failed', {
			userId,
			refIds,
			error: e.message,
		});
		return c.json({ error: 'Ownership check failed', detail: e.message }, 502);
	}

	// Fetch reference buffers in parallel, normalized to clean RGB PNG via
	// mana-media's transform endpoint. gpt-image-1 is picky about color
	// modes and rejects HEIC / CMYK / palette-PNG / APNG with
	// `Invalid image file or mode for image N` — routing through sharp
	// server-side normalizes every upload before it hits OpenAI, and caps
	// the longest side at 1024px to stay well under the 4 MB/image limit.
	// No aspect-ratio distortion (fit=inside).
	let referenceBlobs: Array<{ blob: Blob; filename: string }>;
	try {
		const { getMediaBufferAsPng } = await import('../../lib/media');
		const buffers = await Promise.all(refIds.map((id) => getMediaBufferAsPng(id, 1024)));
		referenceBlobs = buffers.map((b, i) => ({
			blob: new Blob([b.buffer], { type: b.mimeType }),
			filename: `ref-${i}.png`,
		}));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[picture/generate-with-reference] failed to fetch reference media', {
			refIds,
			error: message,
		});
		return c.json({ error: 'Failed to fetch reference media', detail: message }, 502);
	}

	// Multipart POST to OpenAI. FormData auto-sets Content-Type with a
	// boundary; setting it manually would break parsing on OpenAI's end.
	// gpt-image-* requires the array-syntax `image[]` for multi-reference
	// calls — a repeated plain `image` field triggers OpenAI's
	// `duplicate_parameter` error even though the old DALL·E edits
	// endpoint tolerated it. Keep `image[]` for the single-ref case too:
	// OpenAI accepts the array form with any cardinality ≥ 1, so there's
	// no need to branch here.
	function buildFormData(modelName: string): FormData {
		const fd = new FormData();
		fd.append('model', modelName);
		fd.append('prompt', prompt);
		fd.append('size', size);
		fd.append('quality', quality);
		fd.append('n', String(effectiveBatch));
		for (const ref of referenceBlobs) {
			fd.append('image[]', ref.blob, ref.filename);
		}
		return fd;
	}

	async function callOpenAiEdits(
		modelName: string
	): Promise<
		| { ok: true; data: { data?: Array<{ b64_json?: string }> } }
		| { ok: false; status: number; body: string }
	> {
		const res = await fetch('https://api.openai.com/v1/images/edits', {
			method: 'POST',
			headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
			body: buildFormData(modelName),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			return { ok: false, status: res.status, body };
		}
		return { ok: true, data: (await res.json()) as { data?: Array<{ b64_json?: string }> } };
	}

	// "Verify your organization to use gpt-image-2" is a known OpenAI
	// rejection that stays blocked until the user completes their org
	// verification (a manual step on platform.openai.com, sometimes with
	// a 15-min propagation delay). Falling back to gpt-image-1 keeps the
	// Try-On flow usable in the meantime — same edits endpoint, same
	// `image[]` multi-reference semantics, same quality/size values.
	// Only kicks in when the client requested gpt-image-2 (or left the
	// default): an explicit `openai/gpt-image-1` request stays on 1.
	function needsGptImage1Fallback(body: string, attemptedModel: string): boolean {
		if (attemptedModel !== 'gpt-image-2') return false;
		return /verified to use the model/i.test(body);
	}

	// Map our internal size ("1024x1024" | "1024x1536" | "1536x1024")
	// onto Gemini's separate `aspectRatio` + `imageSize`. 1K covers every
	// Try-On output — going higher bloats payload without identifiable
	// quality gain at the thumbnail sizes Wardrobe actually renders.
	function sizeToGemini(s: OpenAiSize): { aspectRatio: string; imageSize: string } {
		if (s === '1024x1536') return { aspectRatio: '2:3', imageSize: '1K' };
		if (s === '1536x1024') return { aspectRatio: '3:2', imageSize: '1K' };
		return { aspectRatio: '1:1', imageSize: '1K' };
	}

	/** Call the Gemini API's generateContent endpoint with multi-image
	 *  inline_data refs + a text prompt, asking for IMAGE back. Returns
	 *  the raw base64 PNG(s) Gemini produced, or a structured failure. */
	async function callGeminiEdits(
		modelName: string
	): Promise<{ ok: true; images: ArrayBuffer[] } | { ok: false; status: number; body: string }> {
		const geminiSize = sizeToGemini(size);
		const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
			{ text: prompt },
		];
		for (const ref of referenceBlobs) {
			const ab = await ref.blob.arrayBuffer();
			const b64 = Buffer.from(new Uint8Array(ab)).toString('base64');
			parts.push({ inline_data: { mime_type: 'image/png', data: b64 } });
		}
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts }],
				generationConfig: {
					// IMAGE alone is rejected; TEXT is required alongside.
					responseModalities: ['TEXT', 'IMAGE'],
					imageConfig: {
						aspectRatio: geminiSize.aspectRatio,
						imageSize: geminiSize.imageSize,
					},
				},
			}),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			return { ok: false, status: res.status, body };
		}
		const data = (await res.json()) as {
			candidates?: Array<{
				content?: {
					parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
				};
			}>;
		};
		const out: ArrayBuffer[] = [];
		for (const cand of data.candidates ?? []) {
			for (const p of cand.content?.parts ?? []) {
				const b64 = p.inlineData?.data;
				if (!b64) continue;
				const bin = Buffer.from(b64, 'base64');
				out.push(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
			}
		}
		if (out.length === 0) {
			return { ok: false, status: 502, body: 'Gemini returned no image parts' };
		}
		return { ok: true, images: out };
	}

	let generatedBuffers: ArrayBuffer[];
	let modelUsed = isOpenAi ? openaiModel : googleModel;
	try {
		if (isOpenAi) {
			let result = await callOpenAiEdits(openaiModel);

			if (!result.ok && needsGptImage1Fallback(result.body, openaiModel)) {
				console.warn(
					'[picture/generate-with-reference] gpt-image-2 unavailable (org not verified), falling back to gpt-image-1'
				);
				modelUsed = 'gpt-image-1';
				result = await callOpenAiEdits('gpt-image-1');
			}

			if (!result.ok) {
				console.error('[picture/generate-with-reference] OpenAI returned non-ok', {
					status: result.status,
					body: result.body.slice(0, 1000),
					refCount: referenceBlobs.length,
					prompt: prompt.slice(0, 120),
					model: modelUsed,
					size,
					quality,
				});
				return c.json(
					{ error: 'OpenAI image edit failed', detail: result.body.slice(0, 500) },
					502
				);
			}

			const blobs = (result.data.data ?? []).map((d) => d.b64_json).filter((b): b is string => !!b);
			if (blobs.length === 0) return c.json({ error: 'OpenAI returned no image data' }, 502);
			generatedBuffers = blobs.map((b64) => {
				const bin = Buffer.from(b64, 'base64');
				return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
			});
		} else {
			// Google / Gemini Nano Banana family.
			const result = await callGeminiEdits(googleModel);
			if (!result.ok) {
				console.error('[picture/generate-with-reference] Gemini returned non-ok', {
					status: result.status,
					body: result.body.slice(0, 1000),
					refCount: referenceBlobs.length,
					prompt: prompt.slice(0, 120),
					model: modelUsed,
					size,
				});
				return c.json(
					{ error: 'Gemini image edit failed', detail: result.body.slice(0, 500) },
					502
				);
			}
			generatedBuffers = result.images;
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[picture/generate-with-reference] provider fetch threw', {
			provider: isOpenAi ? 'openai' : 'google',
			error: message,
		});
		return c.json(
			{ error: `${isOpenAi ? 'OpenAI' : 'Gemini'} image edit failed`, detail: message },
			502
		);
	}

	// Success path: consume credits, then upload the new images.
	// Credits are consumed before the mana-media upload so a mana-media
	// outage doesn't let the user retry free of charge after the model
	// already ran (OpenAI already billed us).
	await consumeCredits(userId, 'AI_IMAGE_GENERATION', cost, `Image edit: ${prompt.slice(0, 50)}`);

	try {
		const { uploadImageToMedia } = await import('../../lib/media');
		const images: Array<{ imageUrl: string; mediaId: string; thumbnailUrl?: string }> = [];
		const ts = Date.now();
		let idx = 0;
		for (const buf of generatedBuffers) {
			const media = await uploadImageToMedia(buf, `edit-${ts}-${idx}.png`, {
				app: 'picture',
				userId,
			});
			images.push({
				imageUrl: media.urls.original,
				mediaId: media.id,
				thumbnailUrl: media.urls.thumbnail,
			});
			idx++;
		}

		// Report the model that actually produced the image, not the one
		// the client asked for — matters when the gpt-image-2 fallback
		// kicked in (we want the picture row's `model` metadata to match
		// the real source for future re-generation / audit).
		const providerPrefix = isOpenAi ? 'openai' : 'google';
		return c.json({
			images,
			prompt,
			model: `${providerPrefix}/${modelUsed}`,
			referenceMediaIds: refIds,
			mode: 'edit',
			// Back-compat: first image exposed at top level too, matching /generate.
			imageUrl: images[0]?.imageUrl,
			mediaId: images[0]?.mediaId,
			thumbnailUrl: images[0]?.thumbnailUrl,
		});
	} catch (_err) {
		// OpenAI already produced images and credits were consumed — degrade
		// to returning the base64 inline so the client can still persist
		// them locally rather than losing the generation entirely.
		const inlineImages = generatedBuffers.map((buf, i) => ({
			mediaId: `inline-${Date.now()}-${i}`,
			imageUrl: `data:image/png;base64,${Buffer.from(buf).toString('base64')}`,
		}));
		return c.json({
			images: inlineImages,
			prompt,
			model,
			referenceMediaIds: refIds,
			mode: 'edit',
			warning: 'mana-media upload failed, images returned inline',
			imageUrl: inlineImages[0]?.imageUrl,
		});
	}
});

// ─── Image Upload (server-only: S3) ─────────────────────────

routes.post('/upload', async (c) => {
	const userId = c.get('userId');
	const formData = await c.req.formData();
	const file = formData.get('file') as File | null;

	if (!file) return c.json({ error: 'No file' }, 400);
	if (file.size > 10 * 1024 * 1024) return c.json({ error: 'Max 10MB' }, 400);

	try {
		const { uploadImageToMedia } = await import('../../lib/media');
		const buffer = await file.arrayBuffer();
		const result = await uploadImageToMedia(buffer, file.name, { app: 'picture', userId });

		return c.json(
			{
				storagePath: result.id,
				publicUrl: result.urls.original,
				mediaId: result.id,
				thumbnailUrl: result.urls.thumbnail,
			},
			201
		);
	} catch (_err) {
		return c.json({ error: 'Upload failed' }, 500);
	}
});

export { routes as pictureRoutes };
