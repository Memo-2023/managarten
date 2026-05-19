/**
 * Split-Screen App Registry
 *
 * Delegates to the unified app registry for component loading and labels.
 */

import { getApp, getAllApps } from '$lib/app-registry';

const SPLIT_APP_ID_LIST = [
	'todo',
	'calendar',
	'contacts',
	'chat',
	'picture',
	'cards',
	'quotes',
	'storage',
	'presi',
	'inventory',
	'photos',
	'skilltree',
	'times',
	'questions',
	'calc',
	'places',
	'automations',
	'playground',
] as const;

export type SplitAppId = (typeof SPLIT_APP_ID_LIST)[number];

export const SPLIT_APP_IDS = SPLIT_APP_ID_LIST as readonly SplitAppId[];

/** Display names for each app (from unified registry). */
export const SPLIT_APP_LABELS: Record<SplitAppId, string> = Object.fromEntries(
	SPLIT_APP_ID_LIST.map((id) => [id, getApp(id)?.name ?? id])
) as Record<SplitAppId, string>;

export async function loadAppComponent(appId: string) {
	const app = getApp(appId);
	if (!app) return null;
	const module = await app.views.list.load();
	return module.default;
}
