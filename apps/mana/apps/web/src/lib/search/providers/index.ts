/**
 * All cross-app search providers, registered lazily.
 *
 * Each provider lives in its own file and pulls in its module's tables /
 * helpers. Registering them eagerly would balloon the initial JS bundle for
 * a feature (spotlight search) that the user only opens on demand. The
 * dynamic `import()` calls below let Vite split each provider into its own
 * chunk that the registry awaits the first time `search()` runs.
 */

import type { SearchRegistry } from '../registry';

export function registerAllProviders(registry: SearchRegistry): void {
	registry.registerLazy('todo', () => import('./todo').then((m) => m.todoSearchProvider));
	registry.registerLazy('calendar', () =>
		import('./calendar').then((m) => m.calendarSearchProvider)
	);
	registry.registerLazy('contacts', () =>
		import('./contacts').then((m) => m.contactsSearchProvider)
	);
	registry.registerLazy('chat', () => import('./chat').then((m) => m.chatSearchProvider));
	registry.registerLazy('storage', () => import('./storage').then((m) => m.storageSearchProvider));
	// 'cards': dekommissioniert 2026-05-08 — Cards eigenständig auf cardecky.mana.how.
	registry.registerLazy('picture', () => import('./picture').then((m) => m.pictureSearchProvider));
	registry.registerLazy('presi', () => import('./presi').then((m) => m.presiSearchProvider));
	registry.registerLazy('clock', () => import('./clock').then((m) => m.clockSearchProvider));
}
