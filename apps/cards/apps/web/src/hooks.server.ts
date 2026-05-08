import type { Handle } from '@sveltejs/kit';

/**
 * Inject the runtime client URLs into <head> on every SSR'd page.
 *
 * `@mana/shared-auth-ui` reads `window.__PUBLIC_MANA_AUTH_URL__` to know
 * where to POST /api/v1/auth/login (and friends). Without this hook the
 * client falls back to a relative URL → 404 on cardecky.mana.how.
 *
 * `process.env.PUBLIC_MANA_*_URL_CLIENT` come from the container
 * environment (docker-compose.macmini.yml). $env/static/public would
 * bake the URLs at build time; we want runtime so the same image can
 * serve dev and prod.
 */

const PUBLIC_MANA_AUTH_URL_CLIENT =
	process.env.PUBLIC_MANA_AUTH_URL_CLIENT || process.env.PUBLIC_MANA_AUTH_URL || '';
const PUBLIC_MANA_SYNC_URL_CLIENT =
	process.env.PUBLIC_MANA_SYNC_URL_CLIENT || process.env.PUBLIC_MANA_SYNC_URL || '';
const PUBLIC_MANA_LLM_URL_CLIENT =
	process.env.PUBLIC_MANA_LLM_URL_CLIENT || process.env.PUBLIC_MANA_LLM_URL || '';
const PUBLIC_MANA_MEDIA_URL_CLIENT =
	process.env.PUBLIC_MANA_MEDIA_URL_CLIENT || process.env.PUBLIC_MANA_MEDIA_URL || '';
const PUBLIC_CARDS_API_URL_CLIENT =
	process.env.PUBLIC_CARDS_API_URL_CLIENT || process.env.PUBLIC_CARDS_API_URL || '';

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event, {
		transformPageChunk: ({ html }) => {
			const envScript =
				`<script>` +
				`window.__PUBLIC_MANA_AUTH_URL__=${JSON.stringify(PUBLIC_MANA_AUTH_URL_CLIENT)};` +
				`window.__PUBLIC_MANA_SYNC_URL__=${JSON.stringify(PUBLIC_MANA_SYNC_URL_CLIENT)};` +
				`window.__PUBLIC_MANA_LLM_URL__=${JSON.stringify(PUBLIC_MANA_LLM_URL_CLIENT)};` +
				`window.__PUBLIC_MANA_MEDIA_URL__=${JSON.stringify(PUBLIC_MANA_MEDIA_URL_CLIENT)};` +
				`window.__PUBLIC_CARDS_API_URL__=${JSON.stringify(PUBLIC_CARDS_API_URL_CLIENT)};` +
				`</script>`;
			return html.replace('<head>', `<head>${envScript}`);
		},
	});
};
