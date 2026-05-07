/**
 * Thin client for mana-notify. Fire-and-forget by design — a failed
 * notification must never roll back a domain action (PR merge, etc.),
 * so all callers `void` the promise and we just log on failure.
 *
 * `appId: 'cards'` keeps these notifications grouped in user
 * preferences so a learner can mute "PR activity" without losing
 * other Mana mail.
 */

interface SendInput {
	channel: 'email' | 'push' | 'webhook';
	userId: string;
	subject: string;
	body: string;
	data?: Record<string, unknown>;
	externalId?: string;
}

interface NotifyClient {
	send(input: SendInput): Promise<void>;
}

export function createNotifyClient(opts: { url: string; serviceKey: string }): NotifyClient {
	return {
		async send(input) {
			try {
				await fetch(`${opts.url}/api/v1/notifications/send`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Service-Key': opts.serviceKey,
					},
					body: JSON.stringify({
						channel: input.channel,
						appId: 'cards',
						userId: input.userId,
						subject: input.subject,
						body: input.body,
						data: input.data,
						externalId: input.externalId,
					}),
				});
			} catch (err) {
				console.warn('[cards-server] notify failed', err);
			}
		},
	};
}

export type { NotifyClient };
