<!--
  RitualRunner — Step-by-step guided routine execution.

  Walks through ritual steps: executes tools, collects user input,
  displays projection data. Tracks progress and logs completion.
-->
<script lang="ts">
	import { Check, ArrowRight, Lightning } from '@mana/shared-icons';
	import { executeTool } from '$lib/data/tools';
	import { useDaySnapshot } from '$lib/data/projections/day-snapshot';
	import { useStreaks } from '$lib/data/projections/streaks';
	import { ritualStore } from '$lib/companion/rituals/store';
	import type { LocalRitual, LocalRitualStep, BreathPattern } from '$lib/companion/rituals/types';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		ritual: LocalRitual;
		onComplete: () => void;
		onClose: () => void;
	}

	let { ritual, onComplete, onClose }: Props = $props();

	const day = useDaySnapshot();
	const streaks = useStreaks();

	let steps = $state<LocalRitualStep[]>([]);
	let currentStepIdx = $state(0);
	let completedSteps = $state<Set<number>>(new Set());
	let stepResult = $state<string | null>(null);
	let inputValue = $state<string | number>('');
	let executing = $state(false);

	// Ceremony step runtime state
	let timerRemaining = $state<number | null>(null);
	let timerHandle: ReturnType<typeof setInterval> | null = null;
	let breathPhase = $state<'inhale' | 'hold1' | 'exhale' | 'hold2' | null>(null);
	let breathCycle = $state(0);
	let breathHandle: ReturnType<typeof setTimeout> | null = null;

	let currentStep = $derived(steps[currentStepIdx]);
	let isLastStep = $derived(currentStepIdx >= steps.length - 1);
	let progress = $derived(steps.length > 0 ? (completedSteps.size / steps.length) * 100 : 0);

	function stopTimer() {
		if (timerHandle) {
			clearInterval(timerHandle);
			timerHandle = null;
		}
		timerRemaining = null;
	}

	function stopBreath() {
		if (breathHandle) {
			clearTimeout(breathHandle);
			breathHandle = null;
		}
		breathPhase = null;
		breathCycle = 0;
	}

	function startTimer(durationSec: number) {
		stopTimer();
		timerRemaining = durationSec;
		timerHandle = setInterval(() => {
			if (timerRemaining == null) return;
			timerRemaining -= 1;
			if (timerRemaining <= 0) {
				stopTimer();
				completeStep();
			}
		}, 1000);
	}

	const BREATH_PRESETS: Record<
		Exclude<BreathPattern, 'custom'>,
		{ inhaleSec: number; hold1Sec: number; exhaleSec: number; hold2Sec: number }
	> = {
		box: { inhaleSec: 4, hold1Sec: 4, exhaleSec: 4, hold2Sec: 4 },
		'4-7-8': { inhaleSec: 4, hold1Sec: 7, exhaleSec: 8, hold2Sec: 0 },
		coherent: { inhaleSec: 5, hold1Sec: 0, exhaleSec: 5, hold2Sec: 0 },
	};

	function startBreath() {
		if (currentStep?.config.type !== 'breath') return;
		const cfg = currentStep.config;
		const timings = cfg.pattern === 'custom' ? cfg.timings : BREATH_PRESETS[cfg.pattern];
		if (!timings) return;
		stopBreath();
		breathCycle = 0;

		const runPhase = (
			phase: 'inhale' | 'hold1' | 'exhale' | 'hold2',
			nextPhase: 'inhale' | 'hold1' | 'exhale' | 'hold2' | 'cycle-end',
			durationSec: number
		) => {
			breathPhase = phase;
			if (durationSec <= 0) {
				dispatchNext(nextPhase);
				return;
			}
			breathHandle = setTimeout(() => dispatchNext(nextPhase), durationSec * 1000);
		};

		const dispatchNext = (step: 'inhale' | 'hold1' | 'exhale' | 'hold2' | 'cycle-end') => {
			if (step === 'hold1') runPhase('hold1', 'exhale', timings.hold1Sec);
			else if (step === 'exhale') runPhase('exhale', 'hold2', timings.exhaleSec);
			else if (step === 'hold2') runPhase('hold2', 'cycle-end', timings.hold2Sec);
			else if (step === 'cycle-end') {
				breathCycle += 1;
				if (breathCycle >= cfg.cycles) {
					stopBreath();
					completeStep();
				} else {
					runPhase('inhale', 'hold1', timings.inhaleSec);
				}
			} else if (step === 'inhale') runPhase('inhale', 'hold1', timings.inhaleSec);
		};

		runPhase('inhale', 'hold1', timings.inhaleSec);
	}

	onMount(async () => {
		steps = await ritualStore.getSteps(ritual.id);
	});

	onDestroy(() => {
		stopTimer();
		stopBreath();
	});

	async function executeCurrentStep() {
		if (!currentStep || executing) return;
		executing = true;
		stepResult = null;

		try {
			const config = currentStep.config;

			if (config.type === 'tool_call') {
				const result = await executeTool(config.toolName, config.params);
				stepResult = result.message;
			} else if (config.type === 'number_input') {
				const val = typeof inputValue === 'number' ? inputValue : Number(inputValue);
				if (isNaN(val)) {
					executing = false;
					return;
				}
				const params = { ...config.baseParams, [config.paramName]: val };
				const result = await executeTool(config.toolName, params);
				stepResult = result.message;
			} else if (config.type === 'text_input') {
				const val = String(inputValue).trim();
				if (!val) {
					executing = false;
					return;
				}
				const params = { ...config.baseParams, [config.paramName]: val };
				const result = await executeTool(config.toolName, params);
				stepResult = result.message;
			} else if (config.type === 'info_display') {
				// Info steps are auto-completed
				stepResult = null;
			}

			completeStep();
		} catch (err) {
			stepResult = `Fehler: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			executing = false;
		}
	}

	function completeStep() {
		completedSteps = new Set([...completedSteps, currentStepIdx]);
		inputValue = '';
	}

	function nextStep() {
		// Leaving the current step — tear down any running ceremony runtime
		stopTimer();
		stopBreath();

		if (isLastStep) {
			ritualStore.logCompletion(ritual.id, completedSteps.size, steps.length);
			onComplete();
			return;
		}
		stepResult = null;
		currentStepIdx++;
		// Auto-complete steps that don't require an action
		const t = currentStep?.config.type;
		if (t === 'info_display' || t === 'presence' || t === 'media') {
			completeStep();
		}
	}

	function skipStep() {
		nextStep();
	}
</script>

{#if steps.length === 0}
	<div class="loading">Lade Ritual...</div>
{:else}
	<div class="ritual-runner">
		<!-- Header -->
		<div class="ritual-header">
			<h3>{ritual.title}</h3>
			<div class="progress-bar">
				<div class="progress-fill" style:width="{progress}%"></div>
			</div>
			<span class="step-counter">{completedSteps.size} / {steps.length}</span>
		</div>

		<!-- Current Step -->
		{#if currentStep}
			<div class="step-card">
				<div class="step-label">{currentStep.label}</div>

				{#if currentStep.config.type === 'tool_call'}
					{#if completedSteps.has(currentStepIdx)}
						<div class="step-done"><Check size={20} weight="bold" /> {stepResult}</div>
					{:else}
						<button class="step-action" onclick={executeCurrentStep} disabled={executing}>
							<Lightning size={16} weight="bold" /> Ausfuehren
						</button>
					{/if}
				{:else if currentStep.config.type === 'number_input'}
					{#if completedSteps.has(currentStepIdx)}
						<div class="step-done"><Check size={20} weight="bold" /> {stepResult}</div>
					{:else}
						<div class="input-row">
							<input
								type="number"
								class="step-input"
								bind:value={inputValue}
								min={currentStep.config.min}
								max={currentStep.config.max}
								placeholder={String(currentStep.config.defaultValue ?? '')}
							/>
							{#if currentStep.config.unit}
								<span class="input-unit">{currentStep.config.unit}</span>
							{/if}
							<button class="step-action" onclick={executeCurrentStep} disabled={executing}>
								Loggen
							</button>
						</div>
					{/if}
				{:else if currentStep.config.type === 'text_input'}
					{#if completedSteps.has(currentStepIdx)}
						<div class="step-done"><Check size={20} weight="bold" /> {stepResult}</div>
					{:else}
						<div class="input-row">
							<input
								type="text"
								class="step-input text"
								bind:value={inputValue}
								placeholder={currentStep.config.placeholder ?? ''}
							/>
							<button class="step-action" onclick={executeCurrentStep} disabled={executing}>
								Speichern
							</button>
						</div>
					{/if}
				{:else if currentStep.config.type === 'info_display'}
					<div class="info-card">
						{#if currentStep.config.source === 'tasks_today'}
							{#if day.value.tasks.dueToday.length > 0}
								{#each day.value.tasks.dueToday as t}
									<div class="info-item">• {t.title}</div>
								{/each}
							{:else}
								<div class="info-empty">Keine Tasks faellig heute</div>
							{/if}
						{:else if currentStep.config.source === 'events_today'}
							{#if day.value.events.upcoming.length > 0}
								{#each day.value.events.upcoming as e}
									<div class="info-item">• {e.title}</div>
								{/each}
							{:else}
								<div class="info-empty">Keine Termine heute</div>
							{/if}
						{:else if currentStep.config.source === 'drink_progress'}
							<div class="info-item">
								Wasser: {day.value.drinks.water.ml}ml / {day.value.drinks.water.goal}ml ({day.value
									.drinks.water.percent}%)
							</div>
							<div class="info-item">Gesamt: {day.value.drinks.total.count} Getraenke</div>
						{:else if currentStep.config.source === 'streaks'}
							{#each streaks.value as s}
								<div class="info-item">
									{s.label}: {s.currentStreak} Tage
									{#if s.status === 'at_risk'}(gefaehrdet){/if}
								</div>
							{/each}
						{/if}
					</div>
				{:else if currentStep.config.type === 'presence'}
					{#if currentStep.config.body}
						<p class="presence-body">{currentStep.config.body}</p>
					{/if}
					{#if currentStep.config.durationSec}
						{#if timerRemaining == null && !completedSteps.has(currentStepIdx)}
							<button
								class="step-action"
								onclick={() =>
									currentStep?.config.type === 'presence' &&
									currentStep.config.durationSec &&
									startTimer(currentStep.config.durationSec)}
							>
								Starten ({currentStep.config.durationSec}s)
							</button>
						{:else if timerRemaining != null}
							<div class="timer-display">
								<span class="timer-num">{timerRemaining}s</span>
								<button
									class="nav-skip"
									onclick={() => {
										stopTimer();
										completeStep();
									}}
								>
									Weiter
								</button>
							</div>
						{:else}
							<div class="step-done"><Check size={20} weight="bold" /> Pause gehalten</div>
						{/if}
					{:else}
						<button class="step-action" onclick={completeStep}>Bereit</button>
					{/if}
				{:else if currentStep.config.type === 'breath'}
					{#if breathPhase == null && !completedSteps.has(currentStepIdx)}
						<p class="presence-body">
							{#if currentStep.config.pattern === 'box'}
								Box-Atmung (4-4-4-4): einatmen, halten, ausatmen, halten.
							{:else if currentStep.config.pattern === '4-7-8'}
								4-7-8: 4 Sek. einatmen, 7 Sek. halten, 8 Sek. ausatmen.
							{:else if currentStep.config.pattern === 'coherent'}
								Kohärent: langsam 5 Sek. rein, 5 Sek. raus.
							{:else}
								Eigenes Muster.
							{/if}
						</p>
						<button class="step-action" onclick={startBreath}>
							Starten — {currentStep.config.cycles} Zyklen
						</button>
					{:else if breathPhase != null}
						<div class="breath-display">
							<div class="breath-circle" data-phase={breathPhase}></div>
							<div class="breath-label">
								{#if breathPhase === 'inhale'}Einatmen{/if}
								{#if breathPhase === 'hold1'}Halten{/if}
								{#if breathPhase === 'exhale'}Ausatmen{/if}
								{#if breathPhase === 'hold2'}Halten{/if}
							</div>
							<div class="breath-cycle">
								Zyklus {breathCycle + 1} / {currentStep.config.cycles}
							</div>
							<button
								class="nav-skip"
								onclick={() => {
									stopBreath();
									completeStep();
								}}
							>
								Früher beenden
							</button>
						</div>
					{:else}
						<div class="step-done"><Check size={20} weight="bold" /> Atmung abgeschlossen</div>
					{/if}
				{:else if currentStep.config.type === 'media'}
					{#if currentStep.config.imageUrl}
						<img
							src={currentStep.config.imageUrl}
							alt={currentStep.config.caption ?? ''}
							class="media-image"
						/>
					{/if}
					{#if currentStep.config.caption}
						<p class="media-caption">{currentStep.config.caption}</p>
					{/if}
					{#if currentStep.config.durationSec}
						{#if timerRemaining == null && !completedSteps.has(currentStepIdx)}
							<button
								class="step-action"
								onclick={() =>
									currentStep?.config.type === 'media' &&
									currentStep.config.durationSec &&
									startTimer(currentStep.config.durationSec)}
							>
								Starten ({currentStep.config.durationSec}s)
							</button>
						{:else if timerRemaining != null}
							<div class="timer-display">
								<span class="timer-num">{timerRemaining}s</span>
								<button
									class="nav-skip"
									onclick={() => {
										stopTimer();
										completeStep();
									}}
								>
									Weiter
								</button>
							</div>
						{/if}
					{/if}
				{/if}
			</div>

			<!-- Navigation -->
			<div class="step-nav">
				<button class="nav-skip" onclick={skipStep}>
					{completedSteps.has(currentStepIdx) || currentStep.config.type === 'info_display'
						? ''
						: 'Ueberspringen'}
				</button>
				<button class="nav-next" onclick={nextStep}>
					{isLastStep ? 'Fertig' : 'Weiter'}
					<ArrowRight size={16} weight="bold" />
				</button>
			</div>
		{/if}

		<!-- Close -->
		<button class="close-btn" onclick={onClose}>Abbrechen</button>
	</div>
{/if}

<style>
	.ritual-runner {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		max-width: 480px;
		margin: 0 auto;
	}

	.loading {
		text-align: center;
		padding: 2rem;
		color: hsl(var(--color-muted-foreground));
	}

	.ritual-header h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: hsl(var(--color-foreground));
		margin: 0 0 0.75rem;
	}

	.progress-bar {
		height: 4px;
		background: hsl(var(--color-muted) / 0.3);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: hsl(var(--color-primary));
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.step-counter {
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
		margin-top: 0.25rem;
	}

	.step-card {
		background: hsl(var(--color-card));
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.75rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.step-label {
		font-size: 1rem;
		font-weight: 500;
		color: hsl(var(--color-foreground));
	}

	.step-action {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		border-radius: 9999px;
		border: none;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground));
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.step-action:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.step-action:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.step-done {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: hsl(var(--color-success, 142 71% 45%));
		font-size: 0.875rem;
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.step-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 1.5px solid hsl(var(--color-border));
		background: hsl(var(--color-background));
		color: hsl(var(--color-foreground));
		font-size: 0.875rem;
		outline: none;
		max-width: 120px;
	}

	.step-input.text {
		max-width: none;
	}

	.step-input:focus {
		border-color: hsl(var(--color-primary));
	}

	.input-unit {
		font-size: 0.8125rem;
		color: hsl(var(--color-muted-foreground));
	}

	.info-card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.info-item {
		font-size: 0.875rem;
		color: hsl(var(--color-foreground));
	}

	.info-empty {
		font-size: 0.875rem;
		color: hsl(var(--color-muted-foreground));
		font-style: italic;
	}

	.step-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.nav-skip {
		border: none;
		background: none;
		color: hsl(var(--color-muted-foreground));
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
	}

	.nav-skip:hover {
		color: hsl(var(--color-foreground));
	}

	.nav-next {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		border-radius: 9999px;
		border: none;
		background: hsl(var(--color-primary) / 0.1);
		color: hsl(var(--color-primary));
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.nav-next:hover {
		background: hsl(var(--color-primary) / 0.2);
	}

	.close-btn {
		align-self: center;
		border: none;
		background: none;
		color: hsl(var(--color-muted-foreground));
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0.375rem 0.75rem;
	}

	.close-btn:hover {
		color: hsl(var(--color-foreground));
	}

	/* ── Ceremony step types ─────────────────────── */

	.presence-body {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: hsl(var(--color-foreground));
		white-space: pre-wrap;
	}

	.timer-display {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.timer-num {
		font-size: 2rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: hsl(var(--color-primary));
	}

	.breath-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem 0;
	}

	.breath-circle {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			hsl(var(--color-primary) / 0.3),
			hsl(var(--color-primary) / 0.1)
		);
		border: 2px solid hsl(var(--color-primary) / 0.5);
		transition: transform 4s ease-in-out;
		transform: scale(0.7);
	}
	.breath-circle[data-phase='inhale'] {
		transform: scale(1.15);
		transition: transform 4s ease-in-out;
	}
	.breath-circle[data-phase='hold1'] {
		transform: scale(1.15);
	}
	.breath-circle[data-phase='exhale'] {
		transform: scale(0.7);
		transition: transform 5s ease-in-out;
	}
	.breath-circle[data-phase='hold2'] {
		transform: scale(0.7);
	}

	.breath-label {
		font-size: 1.1rem;
		font-weight: 500;
		color: hsl(var(--color-foreground));
	}

	.breath-cycle {
		font-size: 0.8rem;
		color: hsl(var(--color-muted-foreground));
	}

	.media-image {
		width: 100%;
		max-height: 240px;
		object-fit: cover;
		border-radius: 0.5rem;
	}

	.media-caption {
		margin: 0;
		font-style: italic;
		text-align: center;
		color: hsl(var(--color-foreground));
	}
</style>
