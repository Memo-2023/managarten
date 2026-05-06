<script lang="ts">
	interface Props {
		size?: number;
		color?: string;
	}

	let { size = 64, color = '#6366f1' }: Props = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 64 64">
	<rect x="6" y="10" width="42" height="50" rx="6" fill={color} opacity="0.85" />
	<rect x="16" y="4" width="42" height="50" rx="6" fill={color} />
</svg>
