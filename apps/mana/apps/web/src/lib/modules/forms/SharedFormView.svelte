<!--
  SharedFormView — public-render of an unlisted form. Rendered by the
  /share/[token] dispatcher when the resolver returned a forms blob.
  Runs without auth — the schema is the only client-side state.

  M4b ships this as the rendering surface; the actual Public-Submit
  POST to mana-api `/api/v1/forms/public/<token>/submit` lands in M3.b
  alongside server-side validation + sync-pickup. Until then, the
  submit button is disabled with an explanatory note.
-->
<script lang="ts">
	import { resolveVisibleFields } from './lib/branching';
	import type { AnswerValue, BranchingRule, FieldOption, FormField, FormSettings } from './types';

	interface FormBlob {
		title: string;
		description: string | null;
		fields: FormField[];
		branching: BranchingRule[];
		settings: Pick<FormSettings, 'submitButtonLabel' | 'successMessage'>;
	}

	let {
		blob,
		token,
		expiresAt,
	}: {
		blob: Record<string, unknown>;
		token: string;
		expiresAt: string | null;
	} = $props();

	const form = $derived(blob as unknown as FormBlob);

	let answers = $state<Record<string, AnswerValue>>({});
	let submitterEmail = $state('');
	let submitterName = $state('');
	let submitted = $state(false);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	function apiBaseUrl(): string {
		// Public-form view is served from the same SvelteKit origin as
		// the Mana webapp, but mana-api is a separate service. The
		// PUBLIC_MANA_API_URL build-var carries the absolute URL in
		// production; for local dev fallback to the conventional
		// :3060 origin used by apps/api.
		const env = import.meta.env as Record<string, string | undefined>;
		const fromEnv = env.PUBLIC_MANA_API_URL;
		if (fromEnv) return fromEnv.replace(/\/$/, '');
		if (typeof window !== 'undefined') {
			return window.location.origin.replace(/:5173/, ':3060');
		}
		return 'http://localhost:3060';
	}

	const visibleFields = $derived(resolveVisibleFields(form.fields, form.branching ?? [], answers));

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

	function ratingScale(field: FormField): number[] {
		const max = field.config?.ratingScale ?? 5;
		return Array.from({ length: max }, (_, i) => i + 1);
	}

	function isFieldRequired(field: FormField): boolean {
		return field.required && field.type !== 'section';
	}

	function isFieldFilled(field: FormField): boolean {
		const v = answers[field.id];
		if (v === null || v === undefined) return false;
		if (typeof v === 'string') return v.trim().length > 0;
		if (Array.isArray(v)) return v.length > 0;
		if (typeof v === 'boolean') return v === true;
		return true;
	}

	const allRequiredFilled = $derived(visibleFields.filter(isFieldRequired).every(isFieldFilled));

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		submitError = null;

		try {
			const url = `${apiBaseUrl()}/api/v1/forms/public/${encodeURIComponent(token)}/submit`;
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					answers,
					submitterEmail: submitterEmail.trim() || null,
					submitterName: submitterName.trim() || null,
				}),
			});
			if (!res.ok) {
				const txt = await res.text().catch(() => '');
				let msg: string | undefined;
				try {
					msg = JSON.parse(txt)?.message;
				} catch {
					msg = txt;
				}
				submitError = msg || `Übertragung fehlgeschlagen (${res.status})`;
				return;
			}
			submitted = true;
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Verbindung zum Server fehlgeschlagen.';
		} finally {
			submitting = false;
		}
	}

	function fmtExpiry(iso: string | null): string {
		if (!iso) return '';
		try {
			return new Date(iso).toLocaleDateString();
		} catch {
			return iso;
		}
	}
</script>

<article class="public-form">
	<header class="hero">
		<h1>{form.title}</h1>
		{#if form.description}
			<p class="description">{form.description}</p>
		{/if}
	</header>

	{#if submitted}
		<div class="thanks">
			<p class="thanks-message">{form.settings.successMessage}</p>
		</div>
	{:else}
		<form class="form-body" onsubmit={handleSubmit}>
			{#each visibleFields as field (field.id)}
				<div class="field" data-type={field.type}>
					{#if field.type === 'section'}
						<hr class="section-divider" />
						<h2 class="section-title">{field.label}</h2>
					{:else if field.type === 'consent'}
						<label class="consent-row">
							<input
								type="checkbox"
								checked={answers[field.id] === true}
								onchange={(e) => setAnswer(field.id, (e.currentTarget as HTMLInputElement).checked)}
							/>
							<span
								>{field.label}
								{#if field.required}<em class="req">*</em>{/if}</span
							>
						</label>
					{:else}
						<label class="field-label">
							{field.label}
							{#if field.required}<em class="req">*</em>{/if}
						</label>
						{#if field.helpText}
							<p class="help">{field.helpText}</p>
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
								oninput={(e) => setAnswer(field.id, (e.currentTarget as HTMLTextAreaElement).value)}
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
							<div class="yes-no">
								<button
									type="button"
									class="yn-btn"
									class:active={answers[field.id] === true}
									onclick={() => setAnswer(field.id, true)}>Ja</button
								>
								<button
									type="button"
									class="yn-btn"
									class:active={answers[field.id] === false}
									onclick={() => setAnswer(field.id, false)}>Nein</button
								>
							</div>
						{:else if field.type === 'rating'}
							<div class="rating">
								{#each ratingScale(field) as n}
									<button
										type="button"
										class="rate-btn"
										class:active={(answers[field.id] as number | undefined) === n}
										onclick={() => setAnswer(field.id, n)}>{n}</button
									>
								{/each}
							</div>
						{:else if field.type === 'single_choice'}
							<div class="options">
								{#each field.options ?? [] as opt (opt.id)}
									<label class="option-row">
										<input
											type="radio"
											name={field.id}
											value={opt.id}
											checked={answers[field.id] === opt.id}
											onchange={() => setAnswer(field.id, opt.id)}
										/>
										<span>{opt.label}</span>
									</label>
								{/each}
							</div>
						{:else if field.type === 'multi_choice'}
							<div class="options">
								{#each field.options ?? [] as opt (opt.id)}
									{@const checked = ((answers[field.id] as string[] | undefined) ?? []).includes(
										opt.id
									)}
									<label class="option-row">
										<input
											type="checkbox"
											value={opt.id}
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

			<div class="submitter-block">
				<label class="field-label">
					Dein Name <span class="optional">(optional)</span>
				</label>
				<input
					type="text"
					value={submitterName}
					oninput={(e) => (submitterName = (e.currentTarget as HTMLInputElement).value)}
					placeholder="Anna Mustermann"
				/>
				<label class="field-label">
					Deine E-Mail <span class="optional">(optional)</span>
				</label>
				<input
					type="email"
					value={submitterEmail}
					oninput={(e) => (submitterEmail = (e.currentTarget as HTMLInputElement).value)}
					placeholder="anna@example.com"
				/>
			</div>

			<footer class="form-footer">
				<button type="submit" class="submit" disabled={!allRequiredFilled || submitting}>
					{submitting ? 'Sende ...' : form.settings.submitButtonLabel}
				</button>
				{#if submitError}
					<p class="error">{submitError}</p>
				{/if}
				{#if expiresAt}
					<p class="expiry">Dieser Link läuft am {fmtExpiry(expiresAt)} ab.</p>
				{/if}
			</footer>
		</form>
	{/if}

	<footer class="brand">
		<a href="https://mana.how/forms" class="brand-link">via Mana Forms</a>
	</footer>
</article>

<style>
	.public-form {
		max-width: 640px;
		margin: 2rem auto;
		padding: 1.5rem;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
		color: #1a1a1a;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	.hero {
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.875rem;
		margin-bottom: 1.25rem;
	}

	.hero h1 {
		margin: 0 0 0.375rem;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.description {
		margin: 0;
		color: #4b5563;
		font-size: 0.9375rem;
		white-space: pre-wrap;
	}

	.form-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.field-label,
	.consent-row {
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.req {
		color: #dc2626;
		font-style: normal;
		margin-left: 0.125rem;
	}

	.help {
		margin: 0;
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.field input[type='text'],
	.field input[type='email'],
	.field input[type='number'],
	.field input[type='date'],
	.field textarea {
		padding: 0.5rem 0.75rem;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.9375rem;
		font-family: inherit;
	}

	.field input:focus,
	.field textarea:focus {
		outline: none;
		border-color: #14b8a6;
		box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.18);
	}

	.section-divider {
		border: none;
		border-top: 1px solid #e5e7eb;
		margin: 0.5rem 0 0;
	}

	.section-title {
		margin: 0.25rem 0 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.consent-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-weight: normal;
		font-size: 0.875rem;
		color: #374151;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.option-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
		font-weight: normal;
	}

	.yes-no,
	.rating {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.yn-btn,
	.rate-btn {
		min-width: 2.5rem;
		padding: 0.375rem 0.75rem;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.yn-btn:hover,
	.rate-btn:hover {
		background: #f9fafb;
	}

	.yn-btn.active,
	.rate-btn.active {
		background: #14b8a6;
		border-color: #14b8a6;
		color: white;
	}

	.form-footer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.submit {
		padding: 0.625rem 1.25rem;
		background: #14b8a6;
		border: none;
		border-radius: 0.375rem;
		color: white;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
	}

	.submit:hover:not(:disabled) {
		background: #0f766e;
	}

	.submit:disabled {
		background: #d1d5db;
		cursor: not-allowed;
	}

	.expiry {
		margin: 0;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.error {
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: #fee2e2;
		border: 1px solid #fca5a5;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		color: #991b1b;
	}

	.submitter-block {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-top: 0.5rem;
		border-top: 1px solid #e5e7eb;
	}

	.optional {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: normal;
	}

	.thanks {
		text-align: center;
		padding: 2rem 1rem;
	}

	.thanks-message {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		color: #1a1a1a;
		white-space: pre-wrap;
	}

	.brand {
		margin-top: 1.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e5e7eb;
		text-align: center;
	}

	.brand-link {
		font-size: 0.75rem;
		color: #6b7280;
		text-decoration: none;
	}

	.brand-link:hover {
		color: #14b8a6;
	}
</style>
