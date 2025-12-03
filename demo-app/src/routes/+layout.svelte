<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../../../src/lib/cjr.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
