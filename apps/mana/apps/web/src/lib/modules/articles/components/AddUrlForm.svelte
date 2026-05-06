<!--
  AddUrlForm — three paths in, one preview/save UI out:

    1. User types / pastes a URL manually.
    2. `?url=…` query (Web Share Target, bookmarklet v1) — auto-fills
       the input and triggers server-side fetch + Readability.
    3. `?source=bookmarklet` (bookmarklet v2) — waits for the opener
       tab to postMessage the rendered HTML over, then runs the
       browser-HTML extract path. This bypasses cookie-consent walls
       and soft paywalls because the HTML already came from the user's
       own authenticated session.

  If the server-side extract returns `warning: 'probable_consent_wall'`
  we keep the preview but add a prominent CTA suggesting the user try
  the browser-HTML path instead.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { articlesStore } from '../stores/articles.svelte';
	import { extractArticle, extractFromHtml, type ExtractedArticle } from '../api';
	import type { Article } from '../types';

	let url = $state('');
	let preview = $state<ExtractedArticle | null>(null);
	let duplicate = $state<Article | null>(null);
	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// a11y: don't use the `autofocus` attribute — route the focus through a
	// use:action so screen-readers announce the page first and the focus
	// happens deliberately after mount.
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}

	/**
	 * Extract the first URL-shaped token from a string — some share
	 * senders (Chrome Android, WhatsApp) stuff the URL into the `text`
	 * slot instead of `url`, often prefixed with the page title.
	 */
	function firstUrl(text: string): string {
		const m = text.match(/https?:\/\/\S+/i);
		return m ? m[0] : '';
	}

	// ─── Bookmarklet-v2 handshake ─────────────────────────
	//
	// When the settings bookmarklet opens Mana with ?source=bookmarklet,
	// the opener tab wants to push its rendered HTML over via
	// postMessage so we can extract WITH the user's cookies/consent
	// already applied. Protocol:
	//
	//   Mana (us)            Opener (the article site)
	//    │                    │
	//    │  mana-ready        │
	//    │ ─────────────────→ │
	//    │                    │
	//    │        mana-html   │
	//    │ ←───────────────── │   { url, html, title }
	//    │                    │
	//
	// We only TRUST the `html` payload — we don't navigate using it, we
	// hand it to our own backend at /api/v1/articles/extract/html which
	// sanitises via Readability. Origin of the sender is free to be
	// anything (that's the whole point) so we don't gate on it.

	let messageHandler: ((e: MessageEvent) => void) | null = null;
	let bookmarkletTimeout: ReturnType<typeof setTimeout> | null = null;

	async function handleBookmarkletHtml(payload: { url: string; html: string; title?: string }) {
		const trimmed = payload.url.trim();
		if (!trimmed) {
			error = 'Bookmarklet hat keine URL mitgeschickt.';
			return;
		}
		url = trimmed;
		reset();
		loading = true;
		try {
			const alreadySaved = await articlesStore.findByUrl(trimmed);
			if (alreadySaved) {
				duplicate = alreadySaved;
				return;
			}
			const extracted = await extractFromHtml(trimmed, payload.html);
			await persistOrShowWarning(extracted);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Extraktion fehlgeschlagen.';
		} finally {
			loading = false;
		}
	}

	function armBookmarkletHandshake() {
		if (typeof window === 'undefined') return;
		messageHandler = (e: MessageEvent) => {
			const data = e.data as { type?: string; url?: string; html?: string; title?: string } | null;
			if (
				!data ||
				data.type !== 'mana-html' ||
				typeof data.url !== 'string' ||
				typeof data.html !== 'string'
			) {
				return;
			}
			// One-shot — disarm so a misbehaving parent can't flood us.
			if (messageHandler) window.removeEventListener('message', messageHandler);
			messageHandler = null;
			if (bookmarkletTimeout) {
				clearTimeout(bookmarkletTimeout);
				bookmarkletTimeout = null;
			}
			void handleBookmarkletHtml({ url: data.url, html: data.html, title: data.title });
		};
		window.addEventListener('message', messageHandler);
		// Tell the opener we're ready to receive. targetOrigin '*' is fine
		// here — the payload in THIS direction is just a readiness ping,
		// no data worth origin-gating.
		try {
			window.opener?.postMessage({ type: 'mana-ready' }, '*');
		} catch {
			// Opener may be cross-origin closed — fall through to timeout.
		}
		// Bail out if nothing arrives within 30s so the UI doesn't sit
		// spinning forever when the user re-opened this page from a stale
		// bookmarklet-v2 link without an opener tab.
		loading = true;
		bookmarkletTimeout = setTimeout(() => {
			if (loading && !preview && !duplicate && !error) {
				loading = false;
				error =
					'Bookmarklet-Handshake ist fehlgeschlagen. Öffne das Bookmarklet aus dem Browser-Tab in dem der Artikel läuft.';
			}
		}, 30_000);
	}

	onMount(() => {
		const params = $page.url.searchParams;
		if (params.get('source') === 'bookmarklet') {
			armBookmarkletHandshake();
			return;
		}
		const fromUrl = params.get('url')?.trim() ?? '';
		const fromText = params.get('text')?.trim() ?? '';
		const candidate = fromUrl || firstUrl(fromText);
		if (candidate) {
			url = candidate;
			// Fire-and-forget — the handler is idempotent enough that a
			// stray second click does no harm.
			void handleSubmit();
		}
	});

	onDestroy(() => {
		if (messageHandler && typeof window !== 'undefined') {
			window.removeEventListener('message', messageHandler);
			messageHandler = null;
		}
		if (bookmarkletTimeout) {
			clearTimeout(bookmarkletTimeout);
			bookmarkletTimeout = null;
		}
	});

	function reset() {
		preview = null;
		duplicate = null;
		error = null;
	}

	async function handleSubmit() {
		reset();
		const trimmed = url.trim();
		if (!trimmed) {
			error = 'Bitte eine URL einfügen.';
			return;
		}
		try {
			new URL(trimmed);
		} catch {
			error = 'Das sieht nicht nach einer gültigen URL aus.';
			return;
		}

		loading = true;
		try {
			const alreadySaved = await articlesStore.findByUrl(trimmed);
			if (alreadySaved) {
				duplicate = alreadySaved;
				return;
			}
			const extracted = await extractArticle(trimmed);
			await persistOrShowWarning(extracted);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Extraktion fehlgeschlagen.';
		} finally {
			loading = false;
		}
	}

	/**
	 * Normal path: extract succeeded cleanly → persist + navigate to the
	 * reader so the user never has to press a second "Save" button.
	 * Fallback: if the server flagged a probable consent wall, stop and
	 * surface the preview + warning card so the user can decide whether
	 * to keep the teaser anyway or re-save via the HTML bookmarklet.
	 */
	async function persistOrShowWarning(extracted: ExtractedArticle) {
		if (extracted.warning === 'probable_consent_wall') {
			preview = extracted;
			return;
		}
		await persistAndGo(extracted);
	}

	async function persistAndGo(extracted: ExtractedArticle) {
		saving = true;
		try {
			const saved = await articlesStore.saveFromExtracted(extracted);
			goto(`/articles/${saved.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.';
			saving = false;
		}
	}

	/** Consent-wall path only: user saw the warning and still wants to keep this. */
	async function saveDespiteWarning() {
		if (!preview) return;
		await persistAndGo(preview);
	}
</script>

<div class="add-shell">
	<header class="header">
		<h1>Artikel speichern</h1>
		<p class="subtitle">URL einfügen — Mana extrahiert + speichert direkt.</p>
	</header>

	<div class="input-row">
		<input
			type="url"
			class="url-input"
			bind:value={url}
			placeholder="https://…"
			disabled={loading || saving}
			onkeydown={(e) => {
				if (e.key === 'Enter') handleSubmit();
			}}
			use:focusOnMount
		/>
		<button type="button" class="primary" disabled={loading || saving} onclick={handleSubmit}>
			{#if saving}Speichere…{:else if loading}Lädt…{:else}Speichern{/if}
		</button>
	</div>

	<p class="bulk-link">
		<a href="/articles/import">{$_('articles.import.bulk_link')}</a>
	</p>

	{#if (loading || saving) && !error && !preview && !duplicate}
		<div class="loading-block" role="status">
			<span class="spinner" aria-hidden="true"></span>
			<div class="loading-text">
				<p class="loading-headline">
					{saving ? 'Speichere in deine Leseliste…' : 'Server extrahiert den Artikel…'}
				</p>
				<p class="loading-sub">
					{saving
						? 'Gleich weiter zum Reader.'
						: 'Dauert normalerweise 2–5 Sekunden. Nach 25 Sekunden geben wir auf.'}
				</p>
			</div>
		</div>
	{/if}

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if duplicate}
		<div class="duplicate">
			<p class="dup-headline">Den hast du schon gespeichert.</p>
			<p class="dup-title">{duplicate.title}</p>
			<div class="dup-actions">
				<button type="button" class="primary" onclick={() => goto(`/articles/${duplicate!.id}`)}>
					Zum gespeicherten Artikel
				</button>
				<button type="button" class="secondary" onclick={reset}>Andere URL</button>
			</div>
		</div>
	{/if}

	{#if preview}
		<!--
		  Preview-Karte erscheint nur noch im Warning-Fall (Consent-Wall).
		  Happy-Path geht direkt zu persistAndGo() und navigiert weg, bevor
		  das Template diesen Block überhaupt rendert.
		-->
		<div class="consent-warning" role="alert">
			<p class="cw-headline">Cookie-Wand erkannt</p>
			<p class="cw-body">
				Der Server hat wahrscheinlich nicht den Artikel bekommen, sondern nur den
				Cookie-Zustimmungs-Dialog der Seite — er hat keine Session / Cookies. Lösung: das
				<strong>Browser-HTML-Bookmarklet</strong> aus
				<a href="/articles/settings">Einstellungen</a> benutzen. Läuft in deinem Tab wo du schon zugestimmt
				hast und schickt Mana das echte Artikel-HTML.
			</p>
			<p class="cw-body cw-body-muted">
				Falls du den Teaser trotzdem speichern willst — OK, kannst du später nochmal mit dem
				HTML-Bookmarklet überschreiben.
			</p>
		</div>
		<article class="preview">
			<h2 class="preview-title">{preview.title}</h2>
			<div class="preview-meta">
				{#if preview.siteName}<span>{preview.siteName}</span>{/if}
				{#if preview.author}<span>· {preview.author}</span>{/if}
				{#if preview.readingTimeMinutes}<span>· {preview.readingTimeMinutes} min</span>{/if}
				{#if preview.wordCount}<span>· {preview.wordCount} Wörter</span>{/if}
			</div>
			{#if preview.excerpt}
				<p class="preview-excerpt">{preview.excerpt}</p>
			{/if}
			<div class="preview-actions">
				<button type="button" class="primary" disabled={saving} onclick={saveDespiteWarning}>
					{saving ? 'Speichere…' : 'Trotzdem speichern'}
				</button>
				<button type="button" class="secondary" onclick={reset} disabled={saving}>
					Abbrechen
				</button>
			</div>
		</article>
	{/if}
</div>

<style>
	.add-shell {
		max-width: 720px;
		margin: 0 auto;
		padding: 1.5rem;
	}
	.header {
		margin-bottom: 1.25rem;
	}
	.header h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.6rem;
	}
	.subtitle {
		color: var(--color-text-muted, #64748b);
		margin: 0;
		font-size: 0.95rem;
	}
	.input-row {
		display: flex;
		gap: 0.55rem;
		margin-bottom: 0.45rem;
	}
	.bulk-link {
		margin: 0 0 0.9rem 0;
		font-size: 0.85rem;
		color: var(--color-text-muted, #64748b);
	}
	.bulk-link a {
		color: #ea580c;
		text-decoration: none;
	}
	.bulk-link a:hover {
		text-decoration: underline;
	}
	.url-input {
		flex: 1;
		padding: 0.6rem 0.85rem;
		border-radius: 0.55rem;
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.12));
		background: var(--color-surface, transparent);
		font: inherit;
		color: inherit;
	}
	.url-input:focus {
		outline: 2px solid #f97316;
		outline-offset: 1px;
		border-color: transparent;
	}
	button {
		padding: 0.55rem 1rem;
		border-radius: 0.55rem;
		font: inherit;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid transparent;
	}
	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.primary {
		background: #f97316;
		color: white;
		border-color: #f97316;
	}
	.primary:hover:not(:disabled) {
		background: #ea580c;
		border-color: #ea580c;
	}
	.secondary {
		background: transparent;
		color: inherit;
		border-color: var(--color-border, rgba(0, 0, 0, 0.15));
	}
	.secondary:hover:not(:disabled) {
		border-color: var(--color-border-strong, rgba(0, 0, 0, 0.3));
	}
	.error {
		padding: 0.55rem 0.85rem;
		border-radius: 0.5rem;
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		font-size: 0.9rem;
	}
	.loading-block {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		padding: 0.75rem 0.95rem;
		border-radius: 0.55rem;
		border: 1px solid color-mix(in srgb, #f97316 30%, transparent);
		background: color-mix(in srgb, #f97316 5%, transparent);
	}
	.spinner {
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		border: 2px solid color-mix(in srgb, #f97316 30%, transparent);
		border-top-color: #f97316;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.loading-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.loading-headline {
		margin: 0;
		font-weight: 500;
		font-size: 0.92rem;
	}
	.loading-sub {
		margin: 0;
		color: var(--color-text-muted, #64748b);
		font-size: 0.82rem;
	}
	.consent-warning {
		margin-top: 1rem;
		padding: 0.85rem 1rem;
		border: 1px solid color-mix(in srgb, #f59e0b 35%, transparent);
		border-radius: 0.55rem;
		background: color-mix(in srgb, #f59e0b 8%, transparent);
	}
	.cw-headline {
		margin: 0 0 0.35rem 0;
		font-weight: 600;
		font-size: 0.95rem;
	}
	.cw-body {
		margin: 0 0 0.45rem 0;
		font-size: 0.88rem;
		line-height: 1.5;
	}
	.cw-body:last-child {
		margin-bottom: 0;
	}
	.cw-body-muted {
		color: var(--color-text-muted, #64748b);
	}
	.consent-warning a {
		color: #ea580c;
		text-decoration: underline;
	}
	.preview,
	.duplicate {
		margin-top: 1rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
		border-radius: 0.75rem;
		background: color-mix(in srgb, #f97316 3%, transparent);
	}
	.preview-title {
		margin: 0 0 0.4rem 0;
		font-size: 1.2rem;
		line-height: 1.35;
	}
	.preview-meta {
		font-size: 0.82rem;
		color: var(--color-text-muted, #64748b);
		margin-bottom: 0.7rem;
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}
	.preview-excerpt {
		margin: 0 0 1rem 0;
		line-height: 1.55;
	}
	.preview-actions,
	.dup-actions {
		display: flex;
		gap: 0.5rem;
	}
	.dup-headline {
		margin: 0 0 0.3rem 0;
		font-weight: 600;
	}
	.dup-title {
		margin: 0 0 0.9rem 0;
		color: var(--color-text-muted, #64748b);
	}
</style>
