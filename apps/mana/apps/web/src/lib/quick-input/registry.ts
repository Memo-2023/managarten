/**
 * Adapter Registry — Maps route prefixes to lazy adapter loaders.
 *
 * Each entry loads the module's adapter only when the user navigates
 * to that module, keeping the initial bundle small.
 */

type AdapterModule = { createAdapter: (...args: unknown[]) => unknown };

const registry = new Map<string, () => Promise<AdapterModule>>([
	['/todo', () => import('$lib/modules/todo/quick-input-adapter')],
	['/calendar', () => import('$lib/modules/calendar/quick-input-adapter')],
	['/contacts', () => import('$lib/modules/contacts/quick-input-adapter')],
	['/times', () => import('$lib/modules/times/quick-input-adapter')],
]);

/**
 * Find the adapter loader for a given pathname.
 * Returns null if no module matches (fallback adapter should be used).
 */
export function getAdapterLoader(pathname: string): (() => Promise<AdapterModule>) | null {
	for (const [prefix, loader] of registry) {
		if (pathname === prefix || pathname.startsWith(prefix + '/')) {
			return loader;
		}
	}
	return null;
}
