<!--
  Public feedback route — outside (app)/ on purpose so AuthGate doesn't
  bounce non-logged-in visitors. Renders a thin shell with brand header
  and Login CTA so the surface stands on its own as a marketing-asset.
-->
<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { HeartHalf } from '@mana/shared-icons';
	import { portalHref } from '$lib/auth/portal-redirect';

	let { children } = $props();
</script>

<div class="public-shell">
	<header class="public-header">
		<a class="brand" href="/">
			<HeartHalf size={20} weight="bold" />
			<span class="brand-text">
				<strong>Mana Feedback</strong>
				<small>Stimmen aus der Mana-Welt</small>
			</span>
		</a>
		<nav class="nav-links">
			<a href="/feedback">Feed</a>
			<a href="/feedback/roadmap">Roadmap</a>
			{#if authStore.user}
				<a class="cta" href="/?app=feedback">In Mana öffnen</a>
			{:else}
				<a class="cta" href={portalHref({ next: '/?app=feedback' })}>Login</a>
			{/if}
		</nav>
	</header>

	<main class="public-main">
		{@render children()}
	</main>

	<footer class="public-footer">
		<p>
			Anonym, aber konsistent — jeder Beitrag kommt von einer "Eule", "Otter" oder einem anderen
			Tier-Pseudonym, das pro Person stabil bleibt. Reagieren und antworten geht nur eingeloggt.
		</p>
	</footer>
</div>

<style>
	.public-shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: hsl(var(--color-background));
		color: hsl(var(--color-foreground));
	}

	.public-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1.25rem;
		border-bottom: 1px solid hsl(var(--color-border));
		background: hsl(var(--color-card));
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		text-decoration: none;
		color: hsl(var(--color-foreground));
	}

	.brand-text {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.brand-text strong {
		font-size: 0.9375rem;
		letter-spacing: -0.01em;
	}

	.brand-text small {
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		font-size: 0.875rem;
	}

	.nav-links a {
		color: hsl(var(--color-muted-foreground));
		text-decoration: none;
	}

	.nav-links a:hover {
		color: hsl(var(--color-foreground));
	}

	.cta {
		padding: 0.375rem 0.75rem;
		border-radius: 999px;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground, 0 0% 100%)) !important;
		font-weight: 600;
	}

	.public-main {
		flex: 1;
		max-width: 960px;
		width: 100%;
		margin: 0 auto;
		padding: 1rem 1rem 2rem;
	}

	.public-footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid hsl(var(--color-border));
		font-size: 0.8125rem;
		color: hsl(var(--color-muted-foreground));
		max-width: 960px;
		width: 100%;
		margin: 0 auto;
	}

	.public-footer p {
		margin: 0;
		line-height: 1.5;
	}
</style>
