<script lang="ts">
	/**
	 * /agents — AI Agents top-level route.
	 *
	 * Renders the existing workbench-card ListView from
	 * `$lib/modules/ai-agents/`. The module folder is named `ai-agents`
	 * for internal clarity, but the user-facing MANA_APPS id + route is
	 * plain `agents` so the URL stays short.
	 */

	import ListView from '$lib/modules/ai-agents/ListView.svelte';
	import { RoutePage } from '$lib/components/shell';
</script>

<RoutePage appId="agents">
	<ListView />
</RoutePage>
