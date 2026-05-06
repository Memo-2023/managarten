<script lang="ts">
	/**
	 * CardFace — renders one learnable unit (a single subIndex of a card)
	 * for any Phase-1 card type. Stateless: the parent owns `showBack`,
	 * `typedAnswer`, and any timing.
	 */

	import { renderCloze, renderMarkdown, type Card } from '@mana/cards-core';

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
					? `<div class="mt-3 text-sm text-neutral-400">${renderMarkdown(card.fields.extra)}</div>`
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
	<div
		class="card-content rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-lg leading-relaxed"
	>
		{@html view.prompt}
	</div>

	{#if isTypeIn}
		<input
			class="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base outline-none focus:border-indigo-400"
			type="text"
			placeholder="Antwort eingeben…"
			value={typedAnswer}
			oninput={(e) => onTypedAnswer?.((e.currentTarget as HTMLInputElement).value)}
			disabled={showBack}
		/>
	{/if}

	{#if showBack}
		<div
			class="card-content rounded-xl border-2 p-6 text-lg leading-relaxed
				{isTypeIn
				? matched
					? 'border-green-500 bg-green-500/5'
					: 'border-red-500 bg-red-500/5'
				: 'border-indigo-500 bg-indigo-500/5'}"
		>
			{@html view.answer}
		</div>
	{/if}
</article>
