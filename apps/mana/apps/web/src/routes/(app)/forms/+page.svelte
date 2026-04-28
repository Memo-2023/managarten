<script lang="ts">
	import ListView from '$lib/modules/forms/ListView.svelte';
	import { RoutePage } from '$lib/components/shell';
</script>

<svelte:head>
	<title>Forms - Mana</title>
</svelte:head>

<RoutePage appId="forms">
	<ListView navigate={() => {}} goBack={() => history.back()} params={{}} />
</RoutePage>
