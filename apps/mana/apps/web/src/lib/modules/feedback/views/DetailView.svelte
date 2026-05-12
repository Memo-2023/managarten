<!--
  DetailView — Single feedback item with its replies. Replies are
  1-level (no nesting). Auth-required to post a reply; guests see the
  thread read-only.
-->
<script lang="ts">
	import type { PublicFeedbackItem, ReactionEmoji } from '@mana/feedback';
	import { useCommunityItem } from '../queries.svelte';
	import ItemCard from '../components/ItemCard.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { feedbackService } from '$lib/api/feedback';
	import { portalHref } from '$lib/auth/portal-redirect';

	interface Props {
		id: string;
	}

	let props: Props = $props();

	// svelte-ignore state_referenced_locally
	let view = useCommunityItem(props.id);

	let replyText = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);

	async function postReply() {
		const trimmed = replyText.trim();
		if (!trimmed || saving) return;
		saving = true;
		error = null;
		try {
			await feedbackService.createFeedback({
				feedbackText: trimmed,
				parentId: props.id,
				isPublic: true,
				category: 'other',
			});
			replyText = '';
			await view.reload();
		} catch (err) {
			console.error('[community/detail] reply failed:', err);
			error = err instanceof Error ? err.message : 'Senden fehlgeschlagen.';
		} finally {
			saving = false;
		}
	}

	async function handleReact(_id: string, emoji: ReactionEmoji) {
		if (!authStore.user) return;
		try {
			const res = await feedbackService.toggleReaction(_id, emoji);
			// Patch parent item in place
			if (view.item && view.item.id === _id) {
				const myReactions = res.userHasReacted
					? Array.from(new Set([...(view.item.myReactions ?? []), emoji]))
					: (view.item.myReactions ?? []).filter((e: string) => e !== emoji);
				view.item.reactions = res.reactions;
				view.item.score = res.score;
				view.item.myReactions = myReactions;
			} else {
				// Patch in replies
				const idx = view.replies.findIndex((r: PublicFeedbackItem) => r.id === _id);
				if (idx >= 0) {
					const old = view.replies[idx];
					const myReactions = res.userHasReacted
						? Array.from(new Set([...(old.myReactions ?? []), emoji]))
						: (old.myReactions ?? []).filter((e: string) => e !== emoji);
					view.replies[idx] = {
						...old,
						reactions: res.reactions,
						score: res.score,
						myReactions,
					};
				}
			}
		} catch (err) {
			console.error('[community/detail] react failed:', err);
		}
	}
</script>

<div class="detail">
	{#if view.loading}
		<div class="state">Lade…</div>
	{:else if view.error || !view.item}
		<div class="state error">{view.error ?? 'Nicht gefunden'}</div>
	{:else}
		<ItemCard item={view.item} readOnly={!authStore.user} onReact={handleReact} />

		<section class="replies">
			<h3 class="replies-header">
				{view.replies.length} Antwort{view.replies.length === 1 ? '' : 'en'}
			</h3>

			{#each view.replies as reply (reply.id)}
				<ItemCard
					item={reply}
					readOnly={!authStore.user}
					onReact={handleReact}
					showAdminResponse={false}
				/>
			{/each}

			{#if authStore.user}
				<div class="reply-form">
					<textarea bind:value={replyText} placeholder="Deine Antwort…" maxlength={2000} rows="3"
					></textarea>
					{#if error}
						<p class="error">{error}</p>
					{/if}
					<button
						class="btn-primary"
						disabled={saving || replyText.trim().length < 3}
						onclick={postReply}
					>
						{saving ? 'Sende…' : 'Antworten'}
					</button>
				</div>
			{:else}
				<p class="login-hint">
					<a href={portalHref()} class="link">Login</a>, um zu antworten.
				</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.75rem;
	}

	.replies {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.replies-header {
		margin: 0 0 0.25rem 0;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: hsl(var(--color-muted-foreground));
	}

	.reply-form {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.reply-form textarea {
		width: 100%;
		padding: 0.625rem 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		background: hsl(var(--color-surface, var(--color-background)));
		color: hsl(var(--color-foreground));
		font: inherit;
		resize: vertical;
	}

	.reply-form textarea:focus {
		outline: none;
		border-color: hsl(var(--color-primary));
		box-shadow: 0 0 0 3px hsl(var(--color-primary) / 0.15);
	}

	.btn-primary {
		align-self: flex-end;
		padding: 0.5rem 0.875rem;
		border: none;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground, 0 0% 100%));
		font-size: 0.875rem;
		font-weight: 600;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.login-hint {
		font-size: 0.8125rem;
		color: hsl(var(--color-muted-foreground));
	}

	.link {
		color: hsl(var(--color-primary));
		text-decoration: underline;
	}

	.state {
		padding: 2rem 1rem;
		text-align: center;
		color: hsl(var(--color-muted-foreground));
	}

	.state.error {
		color: hsl(var(--color-error, 0 84% 60%));
	}

	.error {
		margin: 0;
		font-size: 0.8125rem;
		color: hsl(var(--color-error, 0 84% 60%));
	}
</style>
