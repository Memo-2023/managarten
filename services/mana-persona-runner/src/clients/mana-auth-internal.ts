/**
 * Service-to-service client for the personas internal endpoints.
 *
 * Three calls: list due personas, post actions batch, post feedback
 * batch. All gated by `X-Service-Key` (not a user JWT).
 *
 * After the platform/product split, personas live in apps/api
 * (`managarten/apps/api`), not in mana-auth. The constructor takes
 * the apps/api URL — the file name stays the same to keep the
 * callsite diff small (one import path), but the destination changed.
 */

import type { ActionRow, FeedbackRow } from '../runner/types.ts';

export interface DuePersona {
	userId: string;
	email: string;
	archetype: string;
	systemPrompt: string;
	moduleMix: Record<string, number>;
	tickCadence: 'daily' | 'weekdays' | 'hourly';
	lastActiveAt: string | null;
}

export class ManaAuthInternalClient {
	constructor(
		private readonly apiUrl: string,
		private readonly serviceKey: string
	) {
		if (!serviceKey) {
			throw new Error('ManaAuthInternalClient: serviceKey is required (MANA_SERVICE_KEY)');
		}
	}

	private headers(): Record<string, string> {
		return {
			'content-type': 'application/json',
			'x-service-key': this.serviceKey,
		};
	}

	async listDuePersonas(): Promise<DuePersona[]> {
		const res = await fetch(`${this.apiUrl}/api/v1/personas/internal/due`, {
			headers: this.headers(),
		});
		if (!res.ok) {
			throw new Error(`listDuePersonas failed: HTTP ${res.status} — ${await res.text()}`);
		}
		const body = (await res.json()) as { personas: DuePersona[] };
		return body.personas;
	}

	async postActions(personaId: string, actions: ActionRow[]): Promise<void> {
		if (actions.length === 0) return;
		const res = await fetch(`${this.apiUrl}/api/v1/personas/internal/${personaId}/actions`, {
			method: 'POST',
			headers: this.headers(),
			body: JSON.stringify({ actions }),
		});
		if (!res.ok) {
			throw new Error(`postActions failed: HTTP ${res.status} — ${await res.text()}`);
		}
	}

	async postFeedback(personaId: string, feedback: FeedbackRow[]): Promise<void> {
		if (feedback.length === 0) return;
		const res = await fetch(`${this.apiUrl}/api/v1/personas/internal/${personaId}/feedback`, {
			method: 'POST',
			headers: this.headers(),
			body: JSON.stringify({ feedback }),
		});
		if (!res.ok) {
			throw new Error(`postFeedback failed: HTTP ${res.status} — ${await res.text()}`);
		}
	}
}
