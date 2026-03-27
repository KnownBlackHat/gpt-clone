<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Niva</title>
	<meta name="description" content="Niva – Your Premium AI Intelligence Platform" />
</svelte:head>

{@render children()}
