/**
 * Internal routes — service-to-service (X-Service-Key auth).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AccountService } from '../services/account-service';
import type { BroadcastOrchestrator } from '../services/broadcast-orchestrator';
import { onUserCreatedSchema } from '../lib/validation';

const recipientSchema = z.object({
	email: z.string().email(),
	name: z.string().optional(),
	contactId: z.string().optional(),
});

/**
 * Internal bulk-send (M10d, headless wave-cron):
 * Same payload-shape as the user-facing /api/v1/mail/bulk-send, but
 * the userId comes from the body instead of a JWT — the caller is a
 * trusted Mana service (apps/api forms wave-worker). The X-Service-Key
 * gate sits at the route prefix in index.ts; we additionally require
 * the body to name a userId so audit-logs always carry a principal.
 */
const internalBulkSendSchema = z.object({
	userId: z.string().min(1),
	campaignId: z.string().min(1),
	subject: z.string().min(1),
	fromName: z.string().min(1),
	fromEmail: z.string().email(),
	replyTo: z.string().email().optional(),
	htmlBody: z.string().min(1),
	textBody: z.string().min(1),
	recipients: z.array(recipientSchema).min(1).max(5000),
});

export function createInternalRoutes(
	accountService: AccountService,
	broadcastOrchestrator: BroadcastOrchestrator,
	maxBroadcastRecipients: number
) {
	return new Hono()
		.post('/mail/on-user-created', async (c) => {
			const body = onUserCreatedSchema.parse(await c.req.json());
			try {
				const account = await accountService.provisionAccount(body.userId, body.email, body.name);
				console.log(`[mana-mail] Provisioned ${account.email} for user ${body.userId}`);
				return c.json({ success: true, email: account.email });
			} catch (err) {
				console.error(`[mana-mail] Failed to provision account for ${body.userId}:`, err);
				return c.json(
					{ success: false, error: err instanceof Error ? err.message : 'Unknown error' },
					500
				);
			}
		})
		.post('/mail/on-user-deleted', async (c) => {
			// Phase 2: Deactivate Stalwart account
			return c.json({ success: true, message: 'Not yet implemented' });
		})
		.post('/mail/bulk-send', async (c) => {
			const body = internalBulkSendSchema.parse(await c.req.json());
			if (body.recipients.length > maxBroadcastRecipients) {
				return c.json(
					{
						error: `Recipient count ${body.recipients.length} exceeds configured cap ${maxBroadcastRecipients}`,
					},
					400
				);
			}
			const result = await broadcastOrchestrator.run({
				userId: body.userId,
				campaignId: body.campaignId,
				subject: body.subject,
				fromName: body.fromName,
				fromEmail: body.fromEmail,
				replyTo: body.replyTo,
				htmlBody: body.htmlBody,
				textBody: body.textBody,
				recipients: body.recipients,
				maxRecipients: maxBroadcastRecipients,
			});
			return c.json(result);
		});
}
