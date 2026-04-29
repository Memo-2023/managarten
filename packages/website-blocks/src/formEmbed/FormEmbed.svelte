<!--
  FormEmbed — public-mode renders a Mana Form inline on a published
  website. Edit/preview shows a placeholder card so the editor doesn't
  fire fetches against the public-form endpoint.

  M8 minimal: the block carries `resolved.fields/branching/settings`
  filled at publish-time (see snapshot resolver). If `resolved` is
  missing, the renderer falls back to fetching the snapshot via the
  public unlisted endpoint client-side. That fallback exists for the
  bootstrap window where someone publishes a website with a fresh
  form-embed before the publish-resolver has the chance to inline.
-->
<script lang="ts">
	import type { BlockRenderProps } from '../types';
	import type { FormEmbedField, FormEmbedProps } from './schema';

	let { block, mode }: BlockRenderProps<FormEmbedProps> = $props();

	const isPublic = $derived(mode === 'public');
	const blockProps = $derived(block.props);

	type AnswerValue = string | string[] | number | boolean | null;

	let answers = $state<Record<string, AnswerValue>>({});
	let submitterEmail = $state('');
	let submitterName = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let submitError = $state<string | null>(null);

	// Lazy-resolve fallback — only fires in public mode + when the
	// publish-resolver didn't inline the form schema.
	let fallbackResolved = $state<FormEmbedProps['resolved'] | null>(null);
	let fallbackLoading = $state(false);
	let fallbackError = $state<string | null>(null);

	const resolved = $derived(blockProps.resolved ?? fallbackResolved ?? undefined);

	$effect(() => {
		if (!isPublic) return;
		if (blockProps.resolved) return;
		if (fallbackResolved || fallbackLoading) return;
		if (!blockProps.token) return;
		void loadFallback();
	});

	async function loadFallback() {
		fallbackLoading = true;
		fallbackError = null;
		try {
			const res = await fetch(`/api/v1/unlisted/public/${encodeURIComponent(blockProps.token)}`);
			if (!res.ok) {
				const txt = await res.text().catch(() => '');
				throw new Error(`(${res.status}) ${txt.slice(0, 200)}`);
			}
			const data = (await res.json()) as { collection?: string; blob?: unknown };
			if (data.collection !== 'forms' || !data.blob) {
				throw new Error('Token gehört nicht zu einem Formular');
			}
			const blob = data.blob as {
				title?: string;
				description?: string | null;
				fields?: FormEmbedField[];
				branching?: FormEmbedProps['resolved'] extends infer R
					? R extends { branching: infer B }
						? B
						: never
					: never;
				settings?: { submitButtonLabel?: string; successMessage?: string };
			};
			fallbackResolved = {
				formTitle: blob.title ?? '',
				formDescription: blob.description ?? null,
				fields: blob.fields ?? [],
				branching: (blob.branching as never) ?? [],
				settings: {
					submitButtonLabel: blob.settings?.submitButtonLabel ?? 'Senden',
					successMessage: blob.settings?.successMessage ?? 'Danke!',
				},
			};
		} catch (err) {
			fallbackError = err instanceof Error ? err.message : String(err);
		} finally {
			fallbackLoading = false;
		}
	}

	function setAnswer(fieldId: string, value: AnswerValue) {
		answers = { ...answers, [fieldId]: value };
	}

	function toggleMulti(fieldId: string, optionId: string) {
		const current = (answers[fieldId] as string[] | undefined) ?? [];
		const next = current.includes(optionId)
			? current.filter((v) => v !== optionId)
			: [...current, optionId];
		setAnswer(fieldId, next);
	}

	function ratingScale(field: FormEmbedField): number[] {
		const max = field.config?.ratingScale ?? 5;
		return Array.from({ length: max }, (_, i) => i + 1);
	}

	function isFieldFilled(field: FormEmbedField): boolean {
		const v = answers[field.id];
		if (v === null || v === undefined) return false;
		if (typeof v === 'string') return v.trim().length > 0;
		if (Array.isArray(v)) return v.length > 0;
		if (typeof v === 'boolean') return v === true;
		return true;
	}

	const allRequiredFilled = $derived(
		(resolved?.fields ?? []).filter((f) => f.required && f.type !== 'section').every(isFieldFilled)
	);

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!isPublic) return;
		if (submitting) return;
		submitting = true;
		submitError = null;
		try {
			const res = await fetch(
				`/api/v1/forms/public/${encodeURIComponent(blockProps.token)}/submit`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						answers,
						submitterEmail: submitterEmail.trim() || null,
						submitterName: submitterName.trim() || null,
					}),
				}
			);
			if (!res.ok) {
				const txt = await res.text().catch(() => '');
				let msg: string | undefined;
				try {
					msg = JSON.parse(txt)?.message;
				} catch {
					msg = txt.slice(0, 200);
				}
				submitError = msg || `Übertragung fehlgeschlagen (${res.status})`;
				return;
			}
			submitted = true;
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.';
		} finally {
			submitting = false;
		}
	}

	const headerTitle = $derived(blockProps.titleOverride.trim() || resolved?.formTitle || '');
</script>

<section class="wb-form-embed" data-mode={mode}>
	<div class="wb-form-embed__inner">
		{#if !blockProps.token}
			<div class="wb-form-embed__placeholder">
				<p class="wb-form-embed__hint">
					Kein Form-Token gesetzt. Wähle im Inspector ein veröffentlichtes Mana-Formular aus.
				</p>
			</div>
		{:else if !isPublic}
			<div class="wb-form-embed__placeholder">
				<h2>{headerTitle || 'Eingebettetes Mana-Formular'}</h2>
				<p class="wb-form-embed__hint">
					Token: <code>{blockProps.token.slice(0, 8)}…</code>
				</p>
				{#if resolved?.fields?.length}
					<p class="wb-form-embed__hint">
						{resolved.fields.length} Feld{resolved.fields.length === 1 ? '' : 'er'} — wird beim Veröffentlichen
						frisch aufgelöst.
					</p>
				{:else}
					<p class="wb-form-embed__hint">Form-Schema wird beim Veröffentlichen abgerufen.</p>
				{/if}
			</div>
		{:else if fallbackLoading}
			<p class="wb-form-embed__hint">Lade Formular …</p>
		{:else if fallbackError}
			<p class="wb-form-embed__error">Formular konnte nicht geladen werden: {fallbackError}</p>
		{:else if !resolved}
			<p class="wb-form-embed__error">Form-Schema fehlt.</p>
		{:else if submitted}
			<div class="wb-form-embed__success">{resolved.settings.successMessage}</div>
		{:else}
			{#if headerTitle}
				<h2>{headerTitle}</h2>
			{/if}
			{#if resolved.formDescription}
				<p class="wb-form-embed__description">{resolved.formDescription}</p>
			{/if}
			<form onsubmit={onSubmit} novalidate>
				{#each resolved.fields as field (field.id)}
					<div class="wb-form-embed__field" data-type={field.type}>
						{#if field.type === 'section'}
							<hr class="wb-form-embed__divider" />
							<h3 class="wb-form-embed__section-title">{field.label}</h3>
						{:else if field.type === 'consent'}
							<label class="wb-form-embed__consent">
								<input
									type="checkbox"
									checked={answers[field.id] === true}
									onchange={(e) =>
										setAnswer(field.id, (e.currentTarget as HTMLInputElement).checked)}
								/>
								<span
									>{field.label}{#if field.required}<span class="wb-form-embed__req">*</span
										>{/if}</span
								>
							</label>
						{:else}
							<label class="wb-form-embed__label">
								{field.label}
								{#if field.required}<span class="wb-form-embed__req">*</span>{/if}
							</label>
							{#if field.helpText}
								<small class="wb-form-embed__help">{field.helpText}</small>
							{/if}

							{#if field.type === 'short_text'}
								<input
									type="text"
									maxlength={field.config?.maxLength ?? 200}
									value={(answers[field.id] as string | undefined) ?? ''}
									oninput={(e) => setAnswer(field.id, (e.currentTarget as HTMLInputElement).value)}
								/>
							{:else if field.type === 'long_text'}
								<textarea
									rows="4"
									maxlength={field.config?.maxLength ?? 4000}
									value={(answers[field.id] as string | undefined) ?? ''}
									oninput={(e) =>
										setAnswer(field.id, (e.currentTarget as HTMLTextAreaElement).value)}
								></textarea>
							{:else if field.type === 'email'}
								<input
									type="email"
									value={(answers[field.id] as string | undefined) ?? ''}
									oninput={(e) => setAnswer(field.id, (e.currentTarget as HTMLInputElement).value)}
								/>
							{:else if field.type === 'number'}
								<input
									type="number"
									min={field.config?.min}
									max={field.config?.max}
									value={(answers[field.id] as number | string | undefined) ?? ''}
									oninput={(e) => {
										const v = (e.currentTarget as HTMLInputElement).value;
										setAnswer(field.id, v === '' ? null : Number(v));
									}}
								/>
							{:else if field.type === 'date'}
								<input
									type="date"
									value={(answers[field.id] as string | undefined) ?? ''}
									oninput={(e) => setAnswer(field.id, (e.currentTarget as HTMLInputElement).value)}
								/>
							{:else if field.type === 'yes_no'}
								<div class="wb-form-embed__yn">
									<button
										type="button"
										class:active={answers[field.id] === true}
										onclick={() => setAnswer(field.id, true)}>Ja</button
									>
									<button
										type="button"
										class:active={answers[field.id] === false}
										onclick={() => setAnswer(field.id, false)}>Nein</button
									>
								</div>
							{:else if field.type === 'rating'}
								<div class="wb-form-embed__rating">
									{#each ratingScale(field) as n}
										<button
											type="button"
											class:active={(answers[field.id] as number | undefined) === n}
											onclick={() => setAnswer(field.id, n)}>{n}</button
										>
									{/each}
								</div>
							{:else if field.type === 'single_choice'}
								<div class="wb-form-embed__options">
									{#each field.options ?? [] as opt (opt.id)}
										<label>
											<input
												type="radio"
												name={field.id}
												checked={answers[field.id] === opt.id}
												onchange={() => setAnswer(field.id, opt.id)}
											/>
											<span>{opt.label}</span>
										</label>
									{/each}
								</div>
							{:else if field.type === 'multi_choice'}
								<div class="wb-form-embed__options">
									{#each field.options ?? [] as opt (opt.id)}
										{@const checked = ((answers[field.id] as string[] | undefined) ?? []).includes(
											opt.id
										)}
										<label>
											<input
												type="checkbox"
												{checked}
												onchange={() => toggleMulti(field.id, opt.id)}
											/>
											<span>{opt.label}</span>
										</label>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				{/each}

				<div class="wb-form-embed__submitter">
					<label class="wb-form-embed__label">Dein Name <small>(optional)</small></label>
					<input type="text" bind:value={submitterName} placeholder="Anna Mustermann" />
					<label class="wb-form-embed__label">Deine E-Mail <small>(optional)</small></label>
					<input type="email" bind:value={submitterEmail} placeholder="anna@example.com" />
				</div>

				{#if submitError}
					<p class="wb-form-embed__error">{submitError}</p>
				{/if}

				<button
					type="submit"
					class="wb-form-embed__submit"
					disabled={!allRequiredFilled || submitting}
				>
					{submitting ? 'Sende …' : resolved.settings.submitButtonLabel}
				</button>
			</form>
		{/if}
	</div>
</section>

<style>
	.wb-form-embed {
		padding: 3rem 1.5rem;
		display: flex;
		justify-content: center;
	}
	.wb-form-embed__inner {
		max-width: 36rem;
		width: 100%;
	}
	.wb-form-embed h2 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
	}
	.wb-form-embed__description {
		margin: 0 0 1.5rem;
		opacity: 0.7;
		line-height: 1.5;
		white-space: pre-wrap;
	}
	.wb-form-embed__placeholder {
		padding: 1.5rem;
		background: var(--wb-surface, rgba(127, 127, 127, 0.04));
		border: 1px dashed var(--wb-border, rgba(127, 127, 127, 0.3));
		border-radius: 0.5rem;
	}
	.wb-form-embed__hint {
		margin: 0.25rem 0;
		font-size: 0.875rem;
		opacity: 0.7;
	}
	.wb-form-embed__hint code {
		font-family: ui-monospace, monospace;
		opacity: 0.85;
	}
	.wb-form-embed__error {
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: rgba(220, 38, 38, 0.1);
		border: 1px solid rgba(220, 38, 38, 0.3);
		border-radius: 0.375rem;
		color: rgb(220, 38, 38);
		font-size: 0.875rem;
	}
	.wb-form-embed__success {
		padding: 1rem 1.25rem;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.3);
		border-radius: 0.5rem;
		color: rgb(16, 185, 129);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.wb-form-embed__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.wb-form-embed__label {
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.wb-form-embed__req {
		color: rgb(220, 38, 38);
		margin-left: 0.15rem;
	}
	.wb-form-embed__help {
		font-size: 0.75rem;
		opacity: 0.65;
	}
	.wb-form-embed__field input[type='text'],
	.wb-form-embed__field input[type='email'],
	.wb-form-embed__field input[type='number'],
	.wb-form-embed__field input[type='date'],
	.wb-form-embed__field textarea,
	.wb-form-embed__submitter input {
		padding: 0.625rem 0.75rem;
		border-radius: var(--wb-radius, 0.375rem);
		border: 1px solid var(--wb-border, rgba(127, 127, 127, 0.25));
		background: var(--wb-surface, rgba(255, 255, 255, 0.04));
		color: inherit;
		font-family: inherit;
		font-size: 0.9375rem;
	}
	.wb-form-embed__divider {
		border: none;
		border-top: 1px solid var(--wb-border, rgba(127, 127, 127, 0.2));
		margin: 0.5rem 0 0;
	}
	.wb-form-embed__section-title {
		margin: 0.25rem 0 0;
		font-size: 1rem;
	}
	.wb-form-embed__consent {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		font-size: 0.875rem;
	}
	.wb-form-embed__yn,
	.wb-form-embed__rating {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.wb-form-embed__yn button,
	.wb-form-embed__rating button {
		min-width: 2.5rem;
		padding: 0.375rem 0.75rem;
		border-radius: var(--wb-radius, 0.375rem);
		border: 1px solid var(--wb-border, rgba(127, 127, 127, 0.25));
		background: var(--wb-surface, rgba(255, 255, 255, 0.04));
		color: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.wb-form-embed__yn button.active,
	.wb-form-embed__rating button.active {
		background: var(--wb-primary, rgba(99, 102, 241, 0.9));
		color: var(--wb-primary-fg, white);
		border-color: var(--wb-primary, rgba(99, 102, 241, 0.9));
	}
	.wb-form-embed__options {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.wb-form-embed__options label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.wb-form-embed__submitter {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--wb-border, rgba(127, 127, 127, 0.15));
	}
	.wb-form-embed__submit {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 9999px;
		background: var(--wb-primary, rgba(99, 102, 241, 0.9));
		color: var(--wb-primary-fg, white);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		align-self: flex-start;
	}
	.wb-form-embed__submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
