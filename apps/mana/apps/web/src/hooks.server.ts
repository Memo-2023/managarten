import type { Handle } from '@sveltejs/kit';
import { injectUmamiAnalytics } from '@mana/shared-utils/analytics-server';
import { setSecurityHeaders } from '@mana/shared-utils/security-headers';

/**
 * Server hooks for Mana web app
 *
 * Injects runtime environment variables into the HTML for client-side access.
 * This is necessary because SvelteKit's $env/static/public bakes values at
 * build time, but Docker containers need runtime configuration.
 *
 * The set of injected URLs is intentionally short:
 *   - Auth          → mana-auth (login, sessions, GDPR endpoints)
 *   - Sync          → mana-sync (local-first push/pull/WS for every module)
 *   - Media         → mana-media (CAS / thumbnails)
 *   - LLM           → mana-llm (server-side LLM proxy)
 *   - Events        → mana-events (public RSVP flow)
 *   - Glitchtip DSN → client-side error reporting
 *
 * Per-app HTTP backends (todo-api, calendar-api, contacts-api, chat-api,
 * storage-api, cards-api, mukke-api, picture-api, presi-api,
 * quotes-api, clock-api, context-api) were removed in the pre-launch
 * ghost-API cleanup — every product module now talks to mana-sync directly.
 */

const PUBLIC_MANA_AUTH_URL_CLIENT =
	process.env.PUBLIC_MANA_AUTH_URL_CLIENT || process.env.PUBLIC_MANA_AUTH_URL || '';
const PUBLIC_AUTH_WEB_URL_CLIENT =
	process.env.PUBLIC_AUTH_WEB_URL_CLIENT || process.env.PUBLIC_AUTH_WEB_URL || '';
const PUBLIC_GLITCHTIP_DSN = process.env.PUBLIC_GLITCHTIP_DSN || '';

const PUBLIC_SYNC_SERVER_URL_CLIENT =
	process.env.PUBLIC_SYNC_SERVER_URL_CLIENT || process.env.PUBLIC_SYNC_SERVER_URL || '';
const PUBLIC_MANA_MEDIA_URL_CLIENT =
	process.env.PUBLIC_MANA_MEDIA_URL_CLIENT || process.env.PUBLIC_MANA_MEDIA_URL || '';
const PUBLIC_MANA_LLM_URL_CLIENT =
	process.env.PUBLIC_MANA_LLM_URL_CLIENT || process.env.PUBLIC_MANA_LLM_URL || '';
const PUBLIC_MANA_EVENTS_URL_CLIENT =
	process.env.PUBLIC_MANA_EVENTS_URL_CLIENT || process.env.PUBLIC_MANA_EVENTS_URL || '';
const PUBLIC_MANA_API_URL_CLIENT =
	process.env.PUBLIC_MANA_API_URL_CLIENT || process.env.PUBLIC_MANA_API_URL || '';
const PUBLIC_MANA_CREDITS_URL_CLIENT =
	process.env.PUBLIC_MANA_CREDITS_URL_CLIENT || process.env.PUBLIC_MANA_CREDITS_URL || '';
const PUBLIC_MANA_AI_URL_CLIENT =
	process.env.PUBLIC_MANA_AI_URL_CLIENT || process.env.PUBLIC_MANA_AI_URL || '';
const PUBLIC_MANA_RESEARCH_URL_CLIENT =
	process.env.PUBLIC_MANA_RESEARCH_URL_CLIENT || process.env.PUBLIC_MANA_RESEARCH_URL || '';
const PUBLIC_MANA_ANALYTICS_URL_CLIENT =
	process.env.PUBLIC_MANA_ANALYTICS_URL_CLIENT || process.env.PUBLIC_MANA_ANALYTICS_URL || '';
// Feature flag for the Mission Key-Grant UI (server-side execution of
// encrypted missions). Default off — flip to 'true' per deployment once
// the MANA_AI_PUBLIC/PRIVATE_KEY_PEM pair is provisioned on both services.
const PUBLIC_AI_MISSION_GRANTS = process.env.PUBLIC_AI_MISSION_GRANTS === 'true' ? 'true' : 'false';

// Hostnames that should NEVER be treated as website-builder subdomains.
// Covers the root + common marketing/app/auth surfaces.
const RESERVED_WEBSITE_SUBDOMAINS = new Set([
	'www',
	'api',
	'app',
	'auth',
	'admin',
	'custom', // CNAME target for custom-domain bindings
	's', // reserved to match the /s/ public-renderer prefix
]);

// In-memory cache for custom-domain resolutions. Short TTL keeps
// mana-api query load low without leaving stale bindings around.
// Replaces with Redis/edge KV in M7.
const CUSTOM_HOST_CACHE_MS = 60_000;
const customHostCache = new Map<string, { slug: string | null; expires: number }>();

async function resolveCustomHost(host: string): Promise<string | null> {
	const cached = customHostCache.get(host);
	if (cached && cached.expires > Date.now()) return cached.slug;

	const apiBase = process.env.PUBLIC_MANA_API_URL ?? 'http://localhost:3060';
	try {
		const res = await fetch(
			`${apiBase}/api/v1/website/public/resolve-host?host=${encodeURIComponent(host)}`
		);
		if (res.status === 404) {
			customHostCache.set(host, { slug: null, expires: Date.now() + CUSTOM_HOST_CACHE_MS });
			return null;
		}
		if (!res.ok) return null;
		const body = (await res.json()) as { slug?: string };
		const slug = typeof body.slug === 'string' ? body.slug : null;
		customHostCache.set(host, { slug, expires: Date.now() + CUSTOM_HOST_CACHE_MS });
		return slug;
	} catch {
		return null;
	}
}

/**
 * Returns the site slug this request should be rewritten to, or null
 * if no rewrite applies. Host without port — the handler strips the
 * port before calling.
 */
async function resolveWebsiteRewrite(rawHost: string, subdomain: string): Promise<string | null> {
	// Strip the port if present (dev: `localhost:5173`).
	const host = rawHost.toLowerCase().split(':')[0] ?? '';
	if (!host) return null;

	// Case a — {slug}.mana.how subdomains.
	if (host.endsWith('.mana.how')) {
		const sub = subdomain.toLowerCase();
		// Guard: reserved + existing app subdomains win over website.
		if (APP_SUBDOMAINS.has(sub)) return null;
		if (RESERVED_WEBSITE_SUBDOMAINS.has(sub)) return null;
		// Only single-label subdomains match (no `foo.bar.mana.how`).
		// The label count on `foo.mana.how` is 3 (foo + mana + how).
		if (host.split('.').length !== 3) return null;
		return sub;
	}

	// Case b — custom hostnames.
	//
	// Skip localhost / private addresses in dev so the editor and
	// public-renderer routes on the same localhost instance don't try
	// to resolve themselves as custom domains.
	if (
		host === 'localhost' ||
		host.startsWith('127.') ||
		host === 'mana.how' ||
		host.endsWith('.local')
	) {
		return null;
	}

	return await resolveCustomHost(host);
}

// Map of app subdomains to internal paths
const APP_SUBDOMAINS = new Set([
	'todo',
	'chat',
	'calendar',
	'contacts',
	'quotes',
	'skilltree',
	'cards',
	'storage',
	'presi',
	'photos',
	'music',
	'picture',
	'calc',
	'inventory',
	'times',
	'questions',
]);

export const handle: Handle = async ({ event, resolve }) => {
	// Force HTTPS in production. cloudflared forwards HTTP requests over
	// the tunnel without rewriting the scheme, so a user who types
	// `mana.how` (no scheme → HTTP default) loads the page over HTTP. The
	// browser then sends `Origin: http://mana.how` on every fetch, but
	// mana-auth's CORS only allows `https://mana.how` → all auth requests
	// fail → AuthGate hangs on the loading spinner forever.
	//
	// Detection: prefer cf-visitor / x-forwarded-proto when present
	// (Cloudflare proxy adds them); otherwise fall back to event.url.protocol.
	const host = event.request.headers.get('host') || '';
	const cfVisitor = event.request.headers.get('cf-visitor'); // {"scheme":"http"|"https"}
	const xfProto = event.request.headers.get('x-forwarded-proto');
	let actualProto: 'http' | 'https' = 'https';
	if (cfVisitor) {
		actualProto = cfVisitor.includes('"scheme":"http"') ? 'http' : 'https';
	} else if (xfProto) {
		actualProto = xfProto === 'http' ? 'http' : 'https';
	} else if (event.url.protocol === 'http:') {
		actualProto = 'http';
	}
	const isLocal = host.startsWith('localhost') || host.startsWith('127.');
	const isMana = host.endsWith('mana.how');
	if (actualProto === 'http' && !isLocal && isMana) {
		return new Response(null, {
			status: 301,
			headers: { Location: `https://${host}${event.url.pathname}${event.url.search}` },
		});
	}

	// Redirect app subdomains to their path equivalent
	// e.g. todo.mana.how → mana.how/todo
	const subdomain = host.split('.')[0]; // host already declared above
	if (APP_SUBDOMAINS.has(subdomain) && event.url.pathname === '/') {
		return new Response(null, {
			status: 302,
			headers: { Location: `/${subdomain}` },
		});
	}

	// Website-builder routing (docs/plans/website-builder.md §M6).
	//
	// Two cases:
	//   a) `{siteSlug}.mana.how/path` — subdomain publish. No DB lookup
	//      required; the slug is the first label.
	//   b) `custom-host.com/path` — custom-domain publish. Asks mana-api
	//      for the bound site slug (with a 60s in-memory cache).
	//
	// Both paths rewrite `event.url.pathname` to `/s/{slug}{path}` so
	// SvelteKit serves the existing public renderer. The URL in the
	// browser stays on the custom host — this is a server-side rewrite,
	// not a redirect.
	const websiteRewrite = await resolveWebsiteRewrite(host, subdomain);
	if (websiteRewrite) {
		const current = event.url.pathname;
		const rewritten = `/s/${websiteRewrite}${current === '/' ? '' : current}`;
		event.url.pathname = rewritten;
	}

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => {
			const envScript = `<script>
window.__PUBLIC_MANA_AUTH_URL__ = ${JSON.stringify(PUBLIC_MANA_AUTH_URL_CLIENT)};
window.__PUBLIC_AUTH_WEB_URL__ = ${JSON.stringify(PUBLIC_AUTH_WEB_URL_CLIENT)};
window.__PUBLIC_SYNC_SERVER_URL__ = ${JSON.stringify(PUBLIC_SYNC_SERVER_URL_CLIENT)};
window.__PUBLIC_MANA_MEDIA_URL__ = ${JSON.stringify(PUBLIC_MANA_MEDIA_URL_CLIENT)};
window.__PUBLIC_MANA_LLM_URL__ = ${JSON.stringify(PUBLIC_MANA_LLM_URL_CLIENT)};
window.__PUBLIC_MANA_EVENTS_URL__ = ${JSON.stringify(PUBLIC_MANA_EVENTS_URL_CLIENT)};
window.__PUBLIC_MANA_API_URL__ = ${JSON.stringify(PUBLIC_MANA_API_URL_CLIENT)};
window.__PUBLIC_MANA_CREDITS_URL__ = ${JSON.stringify(PUBLIC_MANA_CREDITS_URL_CLIENT)};
window.__PUBLIC_MANA_AI_URL__ = ${JSON.stringify(PUBLIC_MANA_AI_URL_CLIENT)};
window.__PUBLIC_MANA_RESEARCH_URL__ = ${JSON.stringify(PUBLIC_MANA_RESEARCH_URL_CLIENT)};
window.__PUBLIC_MANA_ANALYTICS_URL__ = ${JSON.stringify(PUBLIC_MANA_ANALYTICS_URL_CLIENT)};
window.__PUBLIC_AI_MISSION_GRANTS__ = ${JSON.stringify(PUBLIC_AI_MISSION_GRANTS)};
window.__PUBLIC_GLITCHTIP_DSN__ = ${JSON.stringify(PUBLIC_GLITCHTIP_DSN)};
</script>`;
			return injectUmamiAnalytics(html.replace('<head>', `<head>${envScript}`));
		},
	});

	const isDev = process.env.NODE_ENV !== 'production';
	setSecurityHeaders(response, {
		// Allow mana-media images (localhost in dev, https in prod)
		imgSrc: isDev ? ['http://localhost:*'] : [],
		// @huggingface/transformers (used by @mana/local-llm) lazy-loads the
		// onnxruntime-web WASM loader from jsDelivr at backend selection
		// time via a dynamic import(). Browsers route dynamic imports
		// through script-src.
		//
		// `blob:` is also required because once the loader .mjs is fetched,
		// onnxruntime-web wraps it in `URL.createObjectURL(new Blob([...]))`
		// and instantiates the result as a multi-threaded Web Worker. The
		// blob URL scheme is its own CSP source — we only allow it for
		// our own origin (the implicit base of blob: is the document
		// origin), so this can't be used to load remote scripts.
		scriptSrc: ['https://cdn.jsdelivr.net', 'blob:'],
		connectSrc: [
			PUBLIC_MANA_AUTH_URL_CLIENT,
			PUBLIC_SYNC_SERVER_URL_CLIENT,
			PUBLIC_MANA_MEDIA_URL_CLIENT,
			PUBLIC_MANA_LLM_URL_CLIENT,
			PUBLIC_MANA_EVENTS_URL_CLIENT,
			PUBLIC_MANA_API_URL_CLIENT,
			PUBLIC_MANA_CREDITS_URL_CLIENT,
			PUBLIC_MANA_ANALYTICS_URL_CLIENT,
			'wss://sync.mana.how',
			// transformers.js *also* fetch()es the .wasm binary and the .mjs
			// loader factory directly to pre-warm the runtime — those go
			// through connect-src, not script-src, so jsDelivr has to be in
			// both lists for the WebGPU backend resolver to succeed.
			'https://cdn.jsdelivr.net',
			// @mana/local-llm (transformers.js) pulls model config + ONNX
			// shards from the HuggingFace ecosystem. HF currently uses three
			// distinct CDN domains depending on file type and rollout state:
			//   - huggingface.co              → repo metadata + small files
			//   - *.huggingface.co            → cdn-lfs-* hosts for legacy LFS
			//   - *.hf.co                     → the new XET-backed CDN
			//                                   (cas-bridge.xethub.hf.co etc.)
			// We allow the broad wildcards because HF rotates the exact host
			// names and a new path lands on a different bucket every few
			// months. Adding the narrow ones too keeps older clients happy.
			'https://huggingface.co',
			'https://*.huggingface.co',
			'https://cdn-lfs.huggingface.co',
			'https://cdn-lfs-us-1.huggingface.co',
			'https://*.hf.co',
			'https://cas-bridge.xethub.hf.co',
			'https://raw.githubusercontent.com',
			// Allow all localhost ports in development
			...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
		].filter(Boolean),
	});

	return response;
};
