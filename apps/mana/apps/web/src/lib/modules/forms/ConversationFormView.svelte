<!--
  ConversationFormView — Typeform-style linearer Chat-Flow für public
  Forms (M9). Statt aller Felder gleichzeitig läuft der User Frage für
  Frage durch. Branching greift wie im SharedFormView (gleicher
  resolver) — wir picken einfach das nächste sichtbare Feld nach jedem
  Schritt aus dem Visible-Subset.

  Field-Type-Handling:
    - short_text / long_text / email / number: Freitext-Input
    - date: native datepicker
    - yes_no: zwei Quick-Reply-Buttons
    - rating: Skala-Buttons (1..5 oder 1..10)
    - single_choice: Quick-Reply-Buttons pro Option
    - multi_choice: Toggle-Chips + "Weiter"-Button
    - section: zeigt Heading-Bubble, "Verstanden"-Button geht weiter
    - consent: Yes-Button (required) bzw. Yes/Skip-Buttons (optional)

  M9b polish (deferred): LLM-Extraction für free-text → strikten Typ
  (z.B. "Ich nehme den zweiten Vorschlag" → option-id), via einem
  /api/v1/forms/public/:token/conversation/extract endpoint.
-->
<script lang="ts">
	import { resolveVisibleFields } from './lib/branching';
	import type { AnswerValue, BranchingRule, FormField, FormSettings } from './types';

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

	// Step pointer + per-step transient input state.
	let stepIndex = $state(0);
	let textDraft = $state('');
	let multiDraft = $state<string[]>([]);
	let submitting = $state(false);
	let submitted = $state(false);
	let submitError = $state<string | null>(null);

	// M9b — free-text "Beschreib's mir" input for choice/yes_no/rating
	// fields. The /conversation/extract endpoint maps it to a typed
	// answer via mana-llm. Result lands in extractedDraft so the user
	// can confirm or override before commit.
	let freeTextDraft = $state('');
	let extracting = $state(false);
	let extractedDraft = $state<{
		extracted: AnswerValue;
		confidence: 'high' | 'low';
		displayText: string;
	} | null>(null);
	let extractError = $state<string | null>(null);

	// Conversation history — pairs of (questionFieldId, displayValue)
	// rendered as chat bubbles above the active step.
	type Bubble = { kind: 'q'; text: string } | { kind: 'a'; text: string };
	let history = $state<Bubble[]>([]);

	const visibleFields = $derived(resolveVisibleFields(form.fields, form.branching ?? [], answers));

	const currentField = $derived<FormField | null>(visibleFields[stepIndex] ?? null);

	const isAtSubmitter = $derived(stepIndex >= visibleFields.length);
	const isAtEnd = $derived(stepIndex >= visibleFields.length + 1);

	$effect(() => {
		// When we land on a new question, push it as a fresh bubble.
		// Effect tracks currentField identity — branching changes that
		// flip the visible set may shift step membership but the
		// already-pushed bubbles stay (history is append-only).
		void currentField;
		void stepIndex;
		if (currentField && !history.some((h) => h.kind === 'q' && h.text === currentField.label)) {
			history = [...history, { kind: 'q', text: currentField.label }];
		}
	});

	function apiBaseUrl(): string {
		const env = import.meta.env as Record<string, string | undefined>;
		const fromEnv = env.PUBLIC_MANA_API_URL;
		if (fromEnv) return fromEnv.replace(/\/$/, '');
		if (typeof window !== 'undefined') {
			return window.location.origin.replace(/:5173/, ':3060');
		}
		return 'http://localhost:3060';
	}

	function pushAnswerBubble(text: string) {
		history = [...history, { kind: 'a', text }];
	}

	function setAnswerAndAdvance(value: AnswerValue, displayText: string) {
		if (!currentField) return;
		answers = { ...answers, [currentField.id]: value };
		pushAnswerBubble(displayText || '—');
		textDraft = '';
		multiDraft = [];
		freeTextDraft = '';
		extractedDraft = null;
		extractError = null;
		stepIndex += 1;
	}

	async function runExtract() {
		if (!currentField) return;
		const text = freeTextDraft.trim();
		if (!text) return;
		extracting = true;
		extractError = null;
		try {
			const url = `${apiBaseUrl()}/api/v1/forms/public/${encodeURIComponent(token)}/conversation/extract`;
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fieldId: currentField.id, freeText: text }),
			});
			if (!res.ok) {
				const txt = await res.text().catch(() => '');
				let msg: string | undefined;
				try {
					msg = JSON.parse(txt)?.message;
				} catch {
					msg = txt.slice(0, 200);
				}
				extractError = msg || `Extraktion fehlgeschlagen (${res.status})`;
				return;
			}
			const json = (await res.json()) as {
				extracted: AnswerValue;
				confidence: 'high' | 'low';
			};
			extractedDraft = {
				extracted: json.extracted,
				confidence: json.confidence,
				displayText: extractedDisplayText(currentField, json.extracted),
			};
		} catch (err) {
			extractError =
				err instanceof Error ? err.message : 'Verbindung zur Extraktion fehlgeschlagen.';
		} finally {
			extracting = false;
		}
	}

	function extractedDisplayText(field: FormField, value: AnswerValue): string {
		if (value === null || value === undefined) return '(unklar)';
		if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
		if (typeof value === 'number') return String(value);
		if (Array.isArray(value)) {
			return value.map((id) => field.options?.find((o) => o.id === id)?.label ?? id).join(', ');
		}
		// single_choice option-id
		return field.options?.find((o) => o.id === value)?.label ?? String(value);
	}

	function commitExtract() {
		if (!currentField || !extractedDraft) return;
		setAnswerAndAdvance(extractedDraft.extracted, extractedDraft.displayText);
	}

	function cancelExtract() {
		freeTextDraft = '';
		extractedDraft = null;
		extractError = null;
	}

	const showFreeTextOption = $derived(
		!!currentField &&
			(currentField.type === 'single_choice' ||
				currentField.type === 'multi_choice' ||
				currentField.type === 'yes_no' ||
				currentField.type === 'rating')
	);

	function handleTextSubmit() {
		if (!currentField) return;
		const trimmed = textDraft.trim();
		if (currentField.required && !trimmed) return;
		if (currentField.type === 'number') {
			if (!trimmed) {
				setAnswerAndAdvance(null, '(übersprungen)');
				return;
			}
			const n = Number(trimmed);
			if (!Number.isFinite(n)) return;
			setAnswerAndAdvance(n, String(n));
		} else {
			setAnswerAndAdvance(trimmed, trimmed);
		}
	}

	function handleQuickPick(value: AnswerValue, label: string) {
		setAnswerAndAdvance(value, label);
	}

	function toggleMulti(optionId: string) {
		multiDraft = multiDraft.includes(optionId)
			? multiDraft.filter((v) => v !== optionId)
			: [...multiDraft, optionId];
	}

	function handleMultiSubmit() {
		if (!currentField) return;
		const opts = currentField.options ?? [];
		const labels = multiDraft.map((id) => opts.find((o) => o.id === id)?.label ?? id).join(', ');
		setAnswerAndAdvance(multiDraft.slice(), labels || '—');
	}

	function handleSectionAck() {
		if (!currentField) return;
		// Sections don't carry an answer; just skip past.
		pushAnswerBubble('OK');
		stepIndex += 1;
	}

	function handleConsent(accepted: boolean) {
		if (!currentField) return;
		setAnswerAndAdvance(accepted, accepted ? 'Ja' : 'Nein');
	}

	function back() {
		if (stepIndex === 0 && history.length === 0) return;
		// Drop the last (q, a) pair — naive but works for linear flow.
		stepIndex = Math.max(0, stepIndex - 1);
		history = history.slice(0, Math.max(0, history.length - 2));
		const prev = visibleFields[stepIndex];
		if (prev) {
			delete answers[prev.id];
			answers = { ...answers };
		}
	}

	async function handleFinalSubmit(e: SubmitEvent) {
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

	function ratingScale(field: FormField): number[] {
		const max = field.config?.ratingScale ?? 5;
		return Array.from({ length: max }, (_, i) => i + 1);
	}

	function fmtExpiry(iso: string | null): string {
		if (!iso) return '';
		try {
			return new Date(iso).toLocaleDateString();
		} catch {
			return iso;
		}
	}

	const progress = $derived(
		visibleFields.length === 0
			? 0
			: Math.min(100, Math.round((stepIndex / (visibleFields.length + 1)) * 100))
	);
</script>

<article class="conv-form">
	<header class="conv-hero">
		<h1>{form.title}</h1>
		{#if form.description}
			<p class="conv-description">{form.description}</p>
		{/if}
	</header>

	<div class="conv-progress" aria-hidden="true">
		<div class="conv-progress__fill" style="width:{progress}%"></div>
	</div>

	<div class="conv-thread" aria-live="polite">
		{#each history as bubble, i (i)}
			<div class="conv-bubble" data-kind={bubble.kind}>{bubble.text}</div>
		{/each}
	</div>

	{#if submitted}
		<div class="conv-thanks">{form.settings.successMessage}</div>
	{:else if isAtEnd}
		<form class="conv-final" onsubmit={handleFinalSubmit}>
			<p class="conv-prompt">
				Fast fertig. Magst du noch deinen Namen / deine E-Mail dalassen? (optional)
			</p>
			<input
				type="text"
				bind:value={submitterName}
				placeholder="Anna Mustermann"
				class="conv-input"
			/>
			<input
				type="email"
				bind:value={submitterEmail}
				placeholder="anna@example.com"
				class="conv-input"
			/>
			{#if submitError}
				<p class="conv-error">{submitError}</p>
			{/if}
			<button type="submit" class="conv-submit" disabled={submitting}>
				{submitting ? 'Sende …' : form.settings.submitButtonLabel}
			</button>
			<button type="button" class="conv-back" onclick={back}>← Zurück</button>
		</form>
	{:else if isAtSubmitter}
		<!-- Should not reach here independently — kept for safety -->
		<p class="conv-prompt">…</p>
	{:else if currentField}
		<div class="conv-step" data-type={currentField.type}>
			{#if currentField.helpText}
				<p class="conv-help">{currentField.helpText}</p>
			{/if}

			{#if currentField.type === 'short_text' || currentField.type === 'long_text' || currentField.type === 'email'}
				<div class="conv-input-row">
					{#if currentField.type === 'long_text'}
						<textarea
							class="conv-input"
							rows="3"
							bind:value={textDraft}
							placeholder="Antwort eingeben …"
							maxlength={currentField.config?.maxLength ?? 4000}
						></textarea>
					{:else}
						<input
							class="conv-input"
							type={currentField.type === 'email' ? 'email' : 'text'}
							bind:value={textDraft}
							placeholder="Antwort eingeben …"
							maxlength={currentField.config?.maxLength ?? 200}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleTextSubmit();
								}
							}}
						/>
					{/if}
					<button
						type="button"
						class="conv-next"
						onclick={handleTextSubmit}
						disabled={currentField.required && !textDraft.trim()}
					>
						Weiter
					</button>
				</div>
			{:else if currentField.type === 'number'}
				<div class="conv-input-row">
					<input
						class="conv-input"
						type="number"
						bind:value={textDraft}
						min={currentField.config?.min}
						max={currentField.config?.max}
						placeholder="Zahl …"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								handleTextSubmit();
							}
						}}
					/>
					<button
						type="button"
						class="conv-next"
						onclick={handleTextSubmit}
						disabled={currentField.required && !textDraft.trim()}
					>
						Weiter
					</button>
				</div>
			{:else if currentField.type === 'date'}
				<div class="conv-input-row">
					<input
						class="conv-input"
						type="date"
						bind:value={textDraft}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								handleTextSubmit();
							}
						}}
					/>
					<button
						type="button"
						class="conv-next"
						onclick={handleTextSubmit}
						disabled={currentField.required && !textDraft.trim()}
					>
						Weiter
					</button>
				</div>
			{:else if currentField.type === 'yes_no'}
				<div class="conv-quick">
					<button type="button" class="conv-quick-btn" onclick={() => handleQuickPick(true, 'Ja')}>
						Ja
					</button>
					<button
						type="button"
						class="conv-quick-btn"
						onclick={() => handleQuickPick(false, 'Nein')}
					>
						Nein
					</button>
				</div>
			{:else if currentField.type === 'rating'}
				<div class="conv-quick">
					{#each ratingScale(currentField) as n}
						<button
							type="button"
							class="conv-quick-btn"
							onclick={() => handleQuickPick(n, String(n))}
						>
							{n}
						</button>
					{/each}
				</div>
			{:else if currentField.type === 'single_choice'}
				<div class="conv-quick conv-quick--column">
					{#each currentField.options ?? [] as opt (opt.id)}
						<button
							type="button"
							class="conv-quick-btn"
							onclick={() => handleQuickPick(opt.id, opt.label)}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			{:else if currentField.type === 'multi_choice'}
				<div class="conv-multi">
					{#each currentField.options ?? [] as opt (opt.id)}
						{@const checked = multiDraft.includes(opt.id)}
						<button
							type="button"
							class="conv-multi-chip"
							class:active={checked}
							onclick={() => toggleMulti(opt.id)}
						>
							{opt.label}
						</button>
					{/each}
					<button
						type="button"
						class="conv-next"
						onclick={handleMultiSubmit}
						disabled={currentField.required && multiDraft.length === 0}
					>
						Weiter
					</button>
				</div>
			{:else if currentField.type === 'section'}
				<button type="button" class="conv-next" onclick={handleSectionAck}> Verstanden </button>
			{:else if currentField.type === 'consent'}
				<div class="conv-quick">
					<button type="button" class="conv-quick-btn" onclick={() => handleConsent(true)}>
						Ja, einverstanden
					</button>
					{#if !currentField.required}
						<button
							type="button"
							class="conv-quick-btn conv-quick-btn--secondary"
							onclick={() => handleConsent(false)}
						>
							Nein
						</button>
					{/if}
				</div>
			{/if}

			{#if showFreeTextOption}
				<details class="conv-freetext">
					<summary>Lieber in eigenen Worten antworten?</summary>
					{#if extractedDraft}
						<div
							class="conv-extract-preview"
							class:low-confidence={extractedDraft.confidence === 'low'}
						>
							<p class="conv-extract-label">Verstanden als:</p>
							<p class="conv-extract-value">{extractedDraft.displayText}</p>
							{#if extractedDraft.confidence === 'low'}
								<p class="conv-extract-hint">
									Klingt nicht eindeutig — bitte prüfe oder wähle direkt einen Button oben.
								</p>
							{/if}
							<div class="conv-extract-actions">
								<button type="button" class="conv-next" onclick={commitExtract}>
									Übernehmen
								</button>
								<button type="button" class="conv-back" onclick={cancelExtract}> Abbrechen </button>
							</div>
						</div>
					{:else}
						<div class="conv-input-row">
							<input
								class="conv-input"
								type="text"
								bind:value={freeTextDraft}
								placeholder={'z.B. „der zweite Vorschlag“'}
								disabled={extracting}
								onkeydown={(e) => {
									if (e.key === 'Enter' && !extracting && freeTextDraft.trim()) {
										e.preventDefault();
										void runExtract();
									}
								}}
							/>
							<button
								type="button"
								class="conv-next"
								onclick={runExtract}
								disabled={extracting || !freeTextDraft.trim()}
							>
								{extracting ? 'Verstehe …' : 'Verstehen'}
							</button>
						</div>
						{#if extractError}
							<p class="conv-extract-error">{extractError}</p>
						{/if}
					{/if}
				</details>
			{/if}

			{#if stepIndex > 0 && currentField.type !== 'section'}
				<button type="button" class="conv-back" onclick={back}>← Vorherige</button>
			{/if}
		</div>
	{/if}

	{#if expiresAt && !submitted}
		<p class="conv-expiry">Dieser Link läuft am {fmtExpiry(expiresAt)} ab.</p>
	{/if}

	<footer class="conv-brand">
		<a href="https://mana.how/forms" class="conv-brand-link">via Mana Forms</a>
	</footer>
</article>

<style>
	.conv-form {
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

	.conv-hero {
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.875rem;
		margin-bottom: 1rem;
	}
	.conv-hero h1 {
		margin: 0 0 0.375rem;
		font-size: 1.5rem;
		font-weight: 600;
	}
	.conv-description {
		margin: 0;
		color: #4b5563;
		font-size: 0.9375rem;
		white-space: pre-wrap;
	}

	.conv-progress {
		height: 4px;
		background: #f3f4f6;
		border-radius: 2px;
		overflow: hidden;
		margin: 0 0 1rem;
	}
	.conv-progress__fill {
		height: 100%;
		background: #14b8a6;
		transition: width 0.25s ease;
	}

	.conv-thread {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.conv-bubble {
		max-width: 85%;
		padding: 0.625rem 0.875rem;
		border-radius: 1rem;
		font-size: 0.9375rem;
		line-height: 1.4;
		white-space: pre-wrap;
	}
	.conv-bubble[data-kind='q'] {
		align-self: flex-start;
		background: #f3f4f6;
		color: #111827;
		border-bottom-left-radius: 0.25rem;
	}
	.conv-bubble[data-kind='a'] {
		align-self: flex-end;
		background: #14b8a6;
		color: white;
		border-bottom-right-radius: 0.25rem;
	}

	.conv-step {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem;
		background: #f9fafb;
		border-radius: 0.625rem;
	}
	.conv-help {
		margin: 0;
		font-size: 0.8125rem;
		color: #6b7280;
	}
	.conv-input-row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}
	.conv-input {
		flex: 1;
		padding: 0.625rem 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		background: white;
		color: inherit;
		font-size: 0.9375rem;
		font-family: inherit;
		resize: vertical;
	}
	.conv-input:focus {
		outline: none;
		border-color: #14b8a6;
		box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.18);
	}
	.conv-next {
		padding: 0.5rem 1rem;
		background: #14b8a6;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}
	.conv-next:hover:not(:disabled) {
		background: #0f766e;
	}
	.conv-next:disabled {
		background: #d1d5db;
		cursor: not-allowed;
	}
	.conv-back {
		align-self: flex-start;
		margin-top: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: none;
		color: #6b7280;
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.conv-back:hover {
		color: #14b8a6;
	}

	.conv-quick {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.conv-quick--column {
		flex-direction: column;
	}
	.conv-quick-btn {
		padding: 0.5rem 1rem;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 9999px;
		color: inherit;
		font-size: 0.9375rem;
		cursor: pointer;
		text-align: left;
	}
	.conv-quick-btn:hover {
		background: #f9fafb;
		border-color: #14b8a6;
		color: #14b8a6;
	}
	.conv-quick-btn--secondary {
		color: #6b7280;
	}

	.conv-multi {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.conv-multi-chip {
		padding: 0.375rem 0.75rem;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 9999px;
		color: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.conv-multi-chip.active {
		background: #14b8a6;
		border-color: #14b8a6;
		color: white;
	}

	.conv-final {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #f9fafb;
		border-radius: 0.625rem;
	}
	.conv-prompt {
		margin: 0 0 0.25rem;
		font-size: 0.9375rem;
		color: #374151;
	}
	.conv-submit {
		padding: 0.625rem 1.25rem;
		background: #14b8a6;
		color: white;
		border: none;
		border-radius: 9999px;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		align-self: flex-start;
	}
	.conv-submit:hover:not(:disabled) {
		background: #0f766e;
	}
	.conv-submit:disabled {
		background: #d1d5db;
		cursor: not-allowed;
	}
	.conv-error {
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: #fee2e2;
		border: 1px solid #fca5a5;
		border-radius: 0.375rem;
		color: #991b1b;
		font-size: 0.8125rem;
	}

	.conv-freetext {
		margin-top: 0.25rem;
		padding: 0.5rem 0;
		border-top: 1px dashed #e5e7eb;
	}
	.conv-freetext summary {
		font-size: 0.8125rem;
		color: #6b7280;
		cursor: pointer;
		padding: 0.25rem 0;
	}
	.conv-freetext summary:hover {
		color: #14b8a6;
	}
	.conv-freetext[open] summary {
		margin-bottom: 0.5rem;
		color: #374151;
	}

	.conv-extract-preview {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.625rem 0.875rem;
		background: rgba(20, 184, 166, 0.1);
		border: 1px solid rgba(20, 184, 166, 0.3);
		border-radius: 0.5rem;
	}
	.conv-extract-preview.low-confidence {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.4);
	}
	.conv-extract-label {
		margin: 0;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #6b7280;
	}
	.conv-extract-value {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 500;
	}
	.conv-extract-hint {
		margin: 0;
		font-size: 0.75rem;
		color: #92400e;
	}
	.conv-extract-actions {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.25rem;
	}
	.conv-extract-error {
		margin: 0.375rem 0 0;
		font-size: 0.8125rem;
		color: #991b1b;
	}

	.conv-thanks {
		text-align: center;
		padding: 2rem 1rem;
		font-size: 1rem;
		color: #1a1a1a;
		white-space: pre-wrap;
	}

	.conv-expiry {
		margin: 1rem 0 0;
		text-align: center;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.conv-brand {
		margin-top: 1.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e5e7eb;
		text-align: center;
	}
	.conv-brand-link {
		font-size: 0.75rem;
		color: #6b7280;
		text-decoration: none;
	}
	.conv-brand-link:hover {
		color: #14b8a6;
	}
</style>
