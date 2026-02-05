<script>
	import { getContext } from 'svelte';

	const { data, xGet, yGet, xScale, yScale } = getContext('LayerCake');

	/**
	 * @typedef {Object} Props
	 * @property {string} [fill='#254c6f'] - The bar's fill color
	 */

	/** @type {Props} */
	let { fill = '#254c6f' } = $props();
</script>

<g class="bar-group">
	{#each $data as d, i}
		{@const barStart = $xScale.range()[0]}
		{@const scaledValue = $xGet(d)}
		{@const barWidth = Math.max(1, scaledValue - barStart)}
		<rect
			class="group-rect"
			data-id={i}
			x={barStart}
			y={$yGet(d)}
			height={$yScale.bandwidth()}
			width={barWidth}
			{fill}
		></rect>
	{/each}
</g>

<style>
	.group-rect {
		transition: fill 0.2s ease;
	}

	.group-rect:hover {
		fill: #1a3a52;
		opacity: 0.9;
	}
</style>
