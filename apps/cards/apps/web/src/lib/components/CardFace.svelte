<script lang="ts">
	/**
	 * CardFace — renders one learnable unit (a single subIndex of a card)
	 * for any Phase-1 card type. Stateless: the parent owns `showBack`,
	 * `typedAnswer`, and any timing.
	 *
	 * Card-feel design (Phase A polish):
	 *   - Single surface that physically flips on Y axis when revealed.
	 *     Both faces share a CSS-grid cell so the parent height is the
	 *     max of front/back, no jumpy reflow on flip.
	 *   - Tap anywhere on the surface reveals (only while `showBack` is
	 *     false). The /learn page keeps the keyboard space/enter shortcut.
	 *   - `prefers-reduced-motion: reduce` collapses the rotateY into an
	 *     instant cross-fade — same affordance, no vestibular trigger.
	 *
	 * Type-in cards skip the flip: the input field doesn't make sense on
	 * a flippable face, so we keep the historical "input + answer below"
	 * layout for that single card type.
	 */

	import { renderCloze, renderMarkdown, type Card } from '@mana/cards-core';

	interface Props {
		card: Card;
		subIndex: number;
		showBack: boolean;
		typedAnswer?: string;
		onTypedAnswer?: (value: string) => void;
		onReveal?: () => void;
	}

	let { card, subIndex, showBack, typedAnswer = '', onTypedAnswer, onReveal }: Props = $props();

	const view = $derived.by(() => {
		switch (card.type) {
			case 'basic':
			case 'type-in':
				return {
					prompt: renderMarkdown(card.fields.front ?? ''),
					answer: renderMarkdown(card.fields.back ?? ''),
					expected: card.fields.back ?? '',
				};
			case 'basic-reverse':
				return subIndex === 0
					? {
							prompt: renderMarkdown(card.fields.front ?? ''),
							answer: renderMarkdown(card.fields.back ?? ''),
							expected: card.fields.back ?? '',
						}
					: {
							prompt: renderMarkdown(card.fields.back ?? ''),
							answer: renderMarkdown(card.fields.front ?? ''),
							expected: card.fields.front ?? '',
						};
			case 'cloze': {
				const r = renderCloze(card.fields.text ?? '', subIndex);
				const extra = card.fields.extra
					? `<div class="mt-3 text-sm text-muted-foreground">${renderMarkdown(card.fields.extra)}</div>`
					: '';
				return { prompt: r.front + extra, answer: r.back + extra, expected: r.answer };
			}
			default:
				return { prompt: '', answer: '', expected: '' };
		}
	});

	const isTypeIn = $derived(card.type === 'type-in');
	const matched = $derived(
		isTypeIn && typedAnswer.trim().toLowerCase() === view.expected.trim().toLowerCase()
	);

	function tryReveal() {
		if (!showBack && !isTypeIn) onReveal?.();
	}
</script>

{#if isTypeIn}
	<!-- Type-in keeps the classic two-block layout: the input is part of the
	     question affordance, so flipping the whole thing would hide it. -->
	<article class="space-y-4">
		<div
			class="card-content rounded-2xl border border-border bg-card p-6 text-lg leading-relaxed shadow-md"
		>
			{@html view.prompt}
		</div>

		<input
			class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base outline-none focus:border-app-accent"
			type="text"
			placeholder="Antwort eingeben…"
			value={typedAnswer}
			oninput={(e) => onTypedAnswer?.((e.currentTarget as HTMLInputElement).value)}
			disabled={showBack}
		/>

		{#if showBack}
			<div
				class="card-content rounded-2xl border-2 p-6 text-lg leading-relaxed
					{matched ? 'border-success bg-success/5' : 'border-error bg-error/5'}"
			>
				{@html view.answer}
			</div>
		{/if}
	</article>
{:else}
	<article class="card-stage">
		<button
			type="button"
			class="card-flip"
			class:flipped={showBack}
			onclick={tryReveal}
			aria-label={showBack ? 'Karte aufgedeckt' : 'Karte aufdecken'}
		>
			<div
				class="card-face card-content card-front rounded-2xl border border-border bg-card p-6 text-lg leading-relaxed shadow-md"
			>
				{@html view.prompt}
				{#if !showBack}
					<p class="card-hint mt-4 text-xs text-muted-foreground/70">
						Tippe auf die Karte oder drücke Leertaste
					</p>
				{/if}
			</div>

			<div
				class="card-face card-content card-back rounded-2xl border-2 border-app-accent bg-app-accent/5 p-6 text-lg leading-relaxed shadow-md"
			>
				{@html view.answer}
			</div>
		</button>
	</article>
{/if}

<style>
	.card-stage {
		perspective: 1500px;
	}

	.card-flip {
		position: relative;
		display: grid;
		width: 100%;
		min-height: 280px;
		padding: 0;
		border: 0;
		background: transparent;
		text-align: left;
		font: inherit;
		color: inherit;
		cursor: pointer;
		transform-style: preserve-3d;
		transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.card-flip.flipped {
		transform: rotateY(180deg);
		cursor: default;
	}

	.card-flip:focus-visible {
		outline: 2px solid hsl(var(--color-app-accent));
		outline-offset: 4px;
		border-radius: 1rem;
	}

	.card-face {
		grid-area: 1 / 1;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.card-back {
		transform: rotateY(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.card-flip,
		.card-flip.flipped {
			transition: none;
			transform: none;
		}
		.card-back {
			transform: none;
			opacity: 0;
			transition: opacity 0.15s ease;
		}
		.card-flip.flipped .card-back {
			opacity: 1;
		}
		.card-flip.flipped .card-front {
			opacity: 0;
		}
	}
</style>
