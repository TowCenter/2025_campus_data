<script>
	import { LayerCake, Svg } from 'layercake';
	import { scaleBand } from 'd3-scale';
	import Bar from './Bar.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {Array<{org: string, count: number}>} data - Array of organization data with counts
	 * @property {number} [height=200] - Chart height
	 * @property {string} [fill='#254c6f'] - Bar fill color
	 */

	/** @type {Props} */
	let {
		data = [],
		height = 200,
		fill = '#254c6f'
	} = $props();

	// Format number as "123k" style
	function formatAxisNumber(num) {
		if (num >= 1000) {
			return Math.round(num / 1000) + 'k';
		}
		return Math.round(num).toString();
	}

	// Format organization name (truncate if too long)
	function formatOrgName(org) {
		if (org.length > 18) {
			return org.substring(0, 18) + '...';
		}
		return org;
	}

	// Transform data to match Layer Cake format
	// For horizontal bars, we need: y = org (ordinal), x = count (linear)
	const chartData = $derived(
		data.map(d => ({
			org: d.org,
			value: d.count
		}))
	);

	const xKey = 'value';
	const yKey = 'org';
</script>

<div class="chart-container">
	<LayerCake
		padding={{ bottom: 40, left: 140, right: 20, top: 10 }}
		x={xKey}
		y={yKey}
		yScale={scaleBand().paddingInner(0.1)}
		xDomain={[0, null]}
		data={chartData}
		height={height}
	>
		<Svg>
			<AxisX tickMarks baseline snapLabels format={formatAxisNumber} />
			<AxisY tickMarks gridlines={false} format={formatOrgName} />
			<Bar {fill} />
		</Svg>
	</LayerCake>
</div>

<style>
	.chart-container {
		width: 100%;
		height: {height}px;
	}
</style>
