/**
 * Author-state store.
 *
 * Lazily fetches the user's author row on first access. Runtime
 * components never read the API directly — they go through this
 * store, so refresh-on-mutation is centralised.
 */

import { cardsApi, CardsApiError, type Author } from '$lib/api/cards-api';

let _author = $state<Author | null>(null);
let _loaded = $state(false);
let _loading = $state(false);
let _error = $state<string | null>(null);

export const authorStore = {
	get author() {
		return _author;
	},
	get loaded() {
		return _loaded;
	},
	get loading() {
		return _loading;
	},
	get error() {
		return _error;
	},
	get isAuthor() {
		return _loaded && _author !== null;
	},

	async load(force = false): Promise<Author | null> {
		if (_loaded && !force) return _author;
		_loading = true;
		_error = null;
		try {
			_author = await cardsApi.authors.me();
		} catch (e) {
			if (e instanceof CardsApiError && e.status === 401) {
				// Not authed — caller's problem, don't poison the store.
				_author = null;
			} else {
				_error = (e as Error).message ?? 'Konnte Author-Profil nicht laden';
			}
		} finally {
			_loaded = true;
			_loading = false;
		}
		return _author;
	},

	async upsert(input: Parameters<typeof cardsApi.authors.upsertMe>[0]): Promise<Author | null> {
		_loading = true;
		_error = null;
		try {
			_author = await cardsApi.authors.upsertMe(input);
			return _author;
		} catch (e) {
			_error = (e as Error).message ?? 'Speichern fehlgeschlagen';
			return null;
		} finally {
			_loading = false;
		}
	},

	reset() {
		_author = null;
		_loaded = false;
		_error = null;
	},
};
