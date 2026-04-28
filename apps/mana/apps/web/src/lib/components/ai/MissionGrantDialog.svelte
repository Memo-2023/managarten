<!--
  MissionGrantDialog
  ==================

  Consent dialog shown when a mission (a) has at least one encrypted-table
  input AND (b) runs autonomously (i.e. anything other than manual
  cadence). Explains the scope, lets the user pick "yes, issue key-grant"
  or "no, foreground only", and calls through to `requestMissionGrant` +
  `setMissionGrant` on approval.

  Surfaces the three error paths distinctly:
    - ZK_ACTIVE     → "not available in zero-knowledge mode"
    - NOT_CONFIGURED→ "server can't issue grants right now"
    - network / 5xx → retry button

  The dialog is intentionally no-framework: plain <dialog> + flat state,
  driven by a `bind:open` prop so the caller controls visibility without
  a store. Matches the pattern used by the other confirm-style dialogs
  in `$lib/components`.
-->
<script lang="ts">
	import type { Mission } from '$lib/data/ai/missions/types';
	import {
		requestMissionGrant,
		ZeroKnowledgeGrantError,
		GrantNotConfiguredError,
		VaultNotInitialisedError,
	} from '$lib/data/ai/missions/grant-client';
	import { setMissionGrant } from '$lib/data/ai/missions/store';
	import { getManaAuthUrl } from '$lib/api/config';
	import { authStore } from '$lib/stores/auth.svelte';

	/**
	 * Tables the webapp's encryption registry flags as encrypted AND the
	 * mana-ai server-side resolver knows how to handle. Keep this list in
	 * sync with `services/mana-ai/src/db/resolvers/index.ts`. A mission
	 * referencing any of these tables triggers the dialog.
	 */
	const ENCRYPTED_SERVER_TABLES = new Set(['notes', 'tasks', 'events', 'journalEntries']);

	interface Props {
		/** Mission to issue the grant for. Required — the dialog reads
		 *  inputs / id / title off it. */
		mission: Mission;
		/** Bound visibility. Caller sets to true to open; dialog flips
		 *  back to false on close / approve / decline. */
		open: boolean;
		/** Optional callback fired after a successful grant is persisted
		 *  on the mission record. */
		onGranted?: () => void;
		/** Optional callback when the user explicitly declines server-side
		 *  execution. The mission stays foreground-only. */
		onDeclined?: () => void;
	}

	let { mission, open = $bindable(false), onGranted, onDeclined }: Props = $props();

	type Status =
		| { kind: 'idle' }
		| { kind: 'submitting' }
		| { kind: 'error'; message: string; code?: 'zk' | 'not-configured' | 'vault' | 'other' };

	let status = $state<Status>({ kind: 'idle' });

	const encryptedInputs = $derived(
		mission.inputs.filter((i) => ENCRYPTED_SERVER_TABLES.has(i.table))
	);
	const tables = $derived([...new Set(encryptedInputs.map((i) => i.table))]);
	const recordIds = $derived(encryptedInputs.map((i) => `${i.table}:${i.id}`));

	async function handleApprove() {
		status = { kind: 'submitting' };
		try {
			const grant = await requestMissionGrant(
				{
					authUrl: getManaAuthUrl(),
					getToken: () => authStore.getValidToken(),
				},
				{
					missionId: mission.id,
					tables,
					recordIds,
				}
			);
			await setMissionGrant(mission.id, grant);
			status = { kind: 'idle' };
			open = false;
			onGranted?.();
		} catch (err) {
			if (err instanceof ZeroKnowledgeGrantError) {
				status = {
					kind: 'error',
					code: 'zk',
					message:
						'Im Zero-Knowledge-Modus kann der Server keinen Schlüssel erhalten. Die Mission läuft weiterhin nur bei offenem Tab.',
				};
				return;
			}
			if (err instanceof GrantNotConfiguredError) {
				status = {
					kind: 'error',
					code: 'not-configured',
					message:
						'Der Server unterstützt Mission-Grants momentan nicht. Versuche es später erneut oder nutze den Vordergrund-Runner.',
				};
				return;
			}
			if (err instanceof VaultNotInitialisedError) {
				status = {
					kind: 'error',
					code: 'vault',
					message:
						'Dein Verschlüsselungs-Vault ist nicht initialisiert. Melde dich einmal ab und wieder an.',
				};
				return;
			}
			status = {
				kind: 'error',
				code: 'other',
				message: err instanceof Error ? err.message : String(err),
			};
		}
	}

	function handleDecline() {
		status = { kind: 'idle' };
		open = false;
		onDeclined?.();
	}

	function handleClose() {
		if (status.kind === 'submitting') return;
		open = false;
	}
</script>

{#if open}
	<div
		class="scrim-wrap"
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="presentation"
	>
		<button type="button" class="scrim" aria-label="Dialog schliessen" onclick={handleClose}
		></button>
		<div class="panel" role="dialog" aria-modal="true" aria-labelledby="grant-dialog-title">
			<h2 id="grant-dialog-title">🔑 Server-Zugriff für diese Mission?</h2>

			<p class="lede">
				Damit <strong>{mission.title}</strong> auch ohne offenen Browser-Tab laufen kann, braucht der
				AI-Runner einmalig einen eng-gescopten Entschlüsselungs-Schlüssel.
			</p>

			<section class="scope">
				<h3>Was sieht der Server?</h3>
				<ul>
					<li>
						<strong>{encryptedInputs.length}</strong> verschlüsselte Record(s) aus:
						<code>{tables.join(', ')}</code>
					</li>
					<li>Nur diese Records — kein Zugriff auf andere Tabellen oder andere Einträge.</li>
					<li>
						Schlüssel ist <strong>7 Tage</strong> gültig und wird bei jedem erfolgreichen Lauf erneuert.
					</li>
					<li>Jeder Zugriff wird geloggt — einsehbar in "Workbench → Datenzugriff".</li>
					<li>Du kannst den Zugriff jederzeit mit einem Klick zurückziehen.</li>
				</ul>
			</section>

			{#if status.kind === 'error'}
				<div class="error" role="alert">
					<strong>Konnte Grant nicht erstellen.</strong>
					<p>{status.message}</p>
				</div>
			{/if}

			<footer class="actions">
				<button
					type="button"
					class="btn-ghost"
					onclick={handleDecline}
					disabled={status.kind === 'submitting'}
				>
					Nur bei offenem Tab ausführen
				</button>
				<button
					type="button"
					class="btn-primary"
					onclick={handleApprove}
					disabled={status.kind === 'submitting'}
				>
					{status.kind === 'submitting' ? 'Erstelle Schlüssel…' : 'Verstanden, Zugriff erteilen'}
				</button>
			</footer>
		</div>
	</div>
{/if}

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && handleClose()} />

<style>
	.scrim-wrap {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.scrim {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.45);
		cursor: pointer;
	}
	.panel {
		position: relative;
		background: hsl(var(--color-surface));
		color: hsl(var(--color-foreground));
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.75rem;
		padding: 1.25rem 1.5rem;
		max-width: 32rem;
		width: 100%;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
	}
	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.0625rem;
	}
	.lede {
		margin: 0 0 1rem;
		font-size: 0.9375rem;
		line-height: 1.4;
	}
	.scope {
		margin: 0 0 1rem;
		padding: 0.75rem 1rem;
		background: color-mix(in oklab, hsl(var(--color-primary)) 6%, hsl(var(--color-surface)));
		border-radius: 0.5rem;
		border: 1px solid color-mix(in oklab, hsl(var(--color-primary)) 25%, transparent);
	}
	.scope h3 {
		margin: 0 0 0.375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: hsl(var(--color-muted-foreground));
	}
	.scope ul {
		margin: 0;
		padding-left: 1.125rem;
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.scope li + li {
		margin-top: 0.125rem;
	}
	.scope code {
		background: hsl(var(--color-surface));
		padding: 0.0625rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}
	.error {
		margin: 0 0 1rem;
		padding: 0.625rem 0.75rem;
		background: color-mix(in oklab, hsl(var(--color-error)) 10%, transparent);
		color: hsl(var(--color-error));
		border: 1px solid color-mix(in oklab, hsl(var(--color-error)) 35%, transparent);
		border-radius: 0.375rem;
		font-size: 0.8125rem;
	}
	.error p {
		margin: 0.25rem 0 0;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.btn-ghost,
	.btn-primary {
		padding: 0.5rem 0.875rem;
		border-radius: 0.375rem;
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.btn-ghost {
		border: 1px solid hsl(var(--color-border));
		background: hsl(var(--color-surface));
		color: hsl(var(--color-foreground));
	}
	.btn-primary {
		border: 1px solid color-mix(in oklab, hsl(var(--color-primary)) 45%, transparent);
		background: color-mix(in oklab, hsl(var(--color-primary)) 18%, hsl(var(--color-surface)));
		color: hsl(var(--color-primary));
	}
	.btn-ghost:disabled,
	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
