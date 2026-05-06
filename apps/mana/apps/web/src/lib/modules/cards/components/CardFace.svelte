<script lang="ts">
	/**
	 * CardFace — renders one learnable unit (a single subIndex of a card)
	 * for any Phase-1 card type. Stateless: the parent owns `showBack`,
	 * `typedAnswer`, and any timing.
	 *
	 *   - basic / basic-reverse subIndex 0: prompt = front, answer = back
	 *   - basic-reverse subIndex 1:         prompt = back,  answer = front
	 *   - cloze subIndex N:                 cloze.renderCloze(text, N)
	 *   - type-in:                          prompt = front, answer = back,
	 *                                       plus an input the user types into.
	 */

	import type { Card } from '../types';
	import { renderCloze } from '../cloze';
	import { renderMarkdown } from '../render';

	interface Props {
		card: Card;
		subIndex: number;
		showBack: boolean;
		typedAnswer?: string;
		onTypedAnswer?: (value: string) => void;
	}

	let { card, subIndex, showBack, typedAnswer = '', onTypedAnswer }: Props = $props();

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
</script>

<article class="space-y-4">
	<div class="rounded-xl border border-border bg-card p-6 text-lg leading-relaxed">
		{@html view.prompt}
	</div>

	{#if isTypeIn}
		<input
			class="w-full rounded-lg border border-border bg-card px-3 py-2 text-base"
			type="text"
			placeholder="Antwort eingeben…"
			value={typedAnswer}
			oninput={(e) => onTypedAnswer?.((e.currentTarget as HTMLInputElement).value)}
			disabled={showBack}
		/>
	{/if}

	{#if showBack}
		<div
			class="rounded-xl border-2 p-6 text-lg leading-relaxed
				{isTypeIn
				? matched
					? 'border-green-500 bg-green-500/5'
					: 'border-red-500 bg-red-500/5'
				: 'border-primary bg-primary/5'}"
		>
			{@html view.answer}
		</div>
	{/if}
</article>
