/**
 * Thin client for mana-credits internal API. Cards-server is a
 * service-to-service caller — the buyer's JWT does not flow through
 * here; we use the X-Service-Key channel instead so we can reserve
 * credits on a user's behalf, commit them after the purchase row is
 * written, and grant the author share in one server-side flow.
 *
 * Errors propagate as Error subclasses so the purchase service can
 * branch on `InsufficientCredits` vs. infra failures.
 */

export class CreditsClientError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'CreditsClientError';
	}
}

export class InsufficientCreditsError extends CreditsClientError {
	constructor(message: string) {
		super(402, 'insufficient_credits', message);
		this.name = 'InsufficientCreditsError';
	}
}

export interface CreditsClient {
	reserve(input: { userId: string; amount: number; reason: string }): Promise<{
		reservationId: string;
		balance: number;
	}>;
	commit(input: { reservationId: string; description?: string }): Promise<unknown>;
	refundReservation(input: { reservationId: string }): Promise<unknown>;
	grant(input: {
		userId: string;
		amount: number;
		reason: string;
		referenceId: string;
		description?: string;
	}): Promise<{ transactionId?: string; grantId?: string } | unknown>;
}

export function createCreditsClient(opts: { url: string; serviceKey: string }): CreditsClient {
	async function call<T>(path: string, body: unknown): Promise<T> {
		const res = await fetch(`${opts.url}/api/v1/internal${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Service-Key': opts.serviceKey,
			},
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			let msg = `${res.status} ${res.statusText}`;
			let code = 'credits_error';
			try {
				const j = (await res.json()) as { code?: string; message?: string };
				if (j.message) msg = j.message;
				if (j.code) code = j.code;
			} catch {
				/* keep default */
			}
			if (res.status === 402 || code === 'insufficient_credits') {
				throw new InsufficientCreditsError(msg);
			}
			throw new CreditsClientError(res.status, code, msg);
		}
		return (await res.json()) as T;
	}

	return {
		reserve: (input) => call('/credits/reserve', input),
		commit: (input) => call('/credits/commit', input),
		refundReservation: (input) => call('/credits/refund-reservation', input),
		grant: (input) => call('/credits/grant', input),
	};
}
