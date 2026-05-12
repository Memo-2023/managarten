<!--
  RouteTierGate — blocks access to routes that require a higher tier
  than the current user holds. Shows a denial panel with the user's
  current tier vs. the required tier.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { locale } from 'svelte-i18n';
	import { authStore } from '$lib/stores/auth.svelte';
	import { redirectToPortal } from '$lib/auth/portal-redirect';

	interface Props {
		appName: string;
		userTierLabel: string;
		requiredTierLabel: string;
	}

	let { appName, userTierLabel, requiredTierLabel }: Props = $props();
	let isDE = $derived(($locale || 'de') === 'de');
</script>

<div class="flex min-h-[60vh] items-center justify-center p-6">
	<div
		class="w-full max-w-96 rounded-2xl border px-8 py-10 text-center shadow-sm"
		style:border-color="hsl(var(--color-border, 0 0% 90%))"
		style:background-color="hsl(var(--color-card, 0 0% 100%))"
	>
		<h1 class="mb-4 text-xl font-bold" style:color="hsl(var(--color-foreground, 0 0% 9%))">
			{appName}
		</h1>
		<div class="mb-4 text-5xl">🔒</div>
		<p
			class="mb-6 text-[0.9375rem] leading-relaxed"
			style:color="hsl(var(--color-muted-foreground, 0 0% 45%))"
		>
			{isDE
				? 'Diese App ist aktuell in der geschlossenen '
				: 'This app is currently in closed '}<strong>{requiredTierLabel}</strong>{isDE
				? '-Phase.'
				: ' phase.'}
		</p>
		<div
			class="mb-6 flex flex-col gap-2 rounded-xl p-4"
			style:background-color="hsl(var(--color-muted, 0 0% 96%))"
		>
			<div class="flex items-center justify-between text-sm">
				<span style:color="hsl(var(--color-muted-foreground, 0 0% 45%))"
					>{isDE ? 'Dein Zugang:' : 'Your access:'}</span
				>
				<span class="font-semibold" style:color="hsl(var(--color-foreground, 0 0% 9%))"
					>{userTierLabel}</span
				>
			</div>
			<div class="flex items-center justify-between text-sm">
				<span style:color="hsl(var(--color-muted-foreground, 0 0% 45%))"
					>{isDE ? 'Benötigt:' : 'Required:'}</span
				>
				<span class="font-semibold text-violet-500">{requiredTierLabel}</span>
			</div>
		</div>
		<div class="flex flex-col gap-2">
			<button
				class="w-full cursor-pointer rounded-lg border-none px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
				style:background-color="hsl(var(--color-primary, 239 84% 67%))"
				style:color="hsl(var(--color-primary-foreground, 0 0% 100%))"
				onclick={() => goto('/')}
			>
				{isDE ? 'Zur Übersicht' : 'Back to overview'}
			</button>
			{#if !authStore.isAuthenticated}
				<button
					class="w-full cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
					style:border-color="hsl(var(--color-border, 0 0% 90%))"
					style:color="hsl(var(--color-foreground, 0 0% 9%))"
					onclick={() => redirectToPortal()}
				>
					{isDE ? 'Anmelden' : 'Sign in'}
				</button>
			{/if}
		</div>
	</div>
</div>
