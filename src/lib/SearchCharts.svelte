<script>
	import { parseDate } from './date-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {any[]} [data=[]] - Filtered data array
	 * @property {string} [dateField='date'] - Field name for dates
	 * @property {string} [orgField='org'] - Field name for organization
	 * @property {string} [searchQuery=''] - Current search query
	 * @property {boolean} [isOpen=false] - Whether the charts panel is open
	 * @property {any} [stats=null] - Precomputed chart stats (optional)
	 * @property {string[]} [fullMonthRange=[]] - Full date range for X-axis (array of month keys like "2025-01")
	 */

	/** @type {Props} */
	let {
		data = [],
		dateField = 'date',
		orgField = 'org',
		searchQuery = '',
		isOpen = $bindable(false),
		stats = null,
		fullMonthRange = []
	} = $props();

	// Auto-open when there's a search query
	$effect(() => {
		if (searchQuery && searchQuery.length > 0) {
			isOpen = true;
		}
	});

	const hasChartData = $derived.by(() => {
		if (stats && typeof stats.totalRecords === 'number') {
			return stats.totalRecords > 0;
		}
		return data.length > 0;
	});

	// Track which organization is being hovered (for bar chart)
	let hoveredOrg = $state(null);

	// Tooltip state for line chart
	let lineTooltip = $state(null);
	let lineTooltipX = $state(0);
	let lineTooltipY = $state(0);

	// Format number as "123k" style
	function formatAxisNumber(num) {
		if (num >= 1000) {
			return Math.round(num / 1000) + 'k';
		}
		return Math.round(num).toString();
	}

	// Calculate nice axis values (evenly spaced round numbers like 0, 50, 100, 150)
	function getNiceAxisValues(maxValue) {
		if (maxValue <= 0) return [0];

		// Define nice step sizes to choose from
		const niceSteps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

		// Find the smallest nice step that gives us reasonable intervals
		let bestStep = 10;
		for (const step of niceSteps) {
			const intervals = Math.ceil(maxValue / step);
			if (intervals >= 3 && intervals <= 6) {
				bestStep = step;
				break;
			}
		}

		// Calculate nice max (round up to next multiple of step)
		const niceMax = Math.ceil(maxValue / bestStep) * bestStep;

		// Create evenly spaced values starting at 0
		const values = [];
		for (let v = 0; v <= niceMax; v += bestStep) {
			values.push(v);
		}
		return values;
	}

	// Process data for charts
	const chartData = $derived.by(() => {
		if (stats && (stats.monthlyCounts || stats.institutionCounts || stats.topInstitutions)) {
			const monthlyTotal = stats.monthlyCounts || {};
			const monthKeys = Object.keys(monthlyTotal).sort();
			const monthLabels = monthKeys.map((key) => {
				const [year, month] = key.split('-');
				const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
				return {
					key,
					label: date.toLocaleString('default', { month: 'short', year: '2-digit' })
				};
			});

			const top5Orgs = Array.isArray(stats.topInstitutions) && stats.topInstitutions.length > 0
				? stats.topInstitutions
				: Object.entries(stats.institutionCounts || {})
						.sort((a, b) => b[1] - a[1])
						.slice(0, 5)
						.map(([org, count]) => ({ org, count }));

			const maxMonthlyTotal = Math.max(1, ...Object.values(monthlyTotal));
			const maxOrgCount = top5Orgs.length > 0 ? top5Orgs[0].count : 1;
			const totalSchools = typeof stats.totalSchools === 'number'
				? stats.totalSchools
				: Object.values(stats.institutionCounts || {}).filter((count) => count > 0).length;
			const totalRecords = typeof stats.totalRecords === 'number' ? stats.totalRecords : 0;

			return {
				monthlyByOrg: {},
				monthlyTotal,
				monthLabels,
				top5Orgs,
				maxMonthlyTotal,
				maxOrgCount,
				allOrgs: [],
				totalSchools,
				totalRecords
			};
		}

		const monthlyByOrg = {};
		const monthlyTotal = {};
		const orgCounts = {};

		data.forEach((item) => {
			// Get date
			const dateValue = item[dateField];
			if (!dateValue) return;

			const dateObj = parseDate(dateValue);
			if (isNaN(dateObj.getTime())) return;

			// Create month key (YYYY-MM format for sorting)
			const year = dateObj.getFullYear();
			const month = dateObj.getMonth();
			const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

			// Get organization(s)
			const orgs = Array.isArray(item[orgField]) ? item[orgField] : [item[orgField]];

			orgs.forEach((org) => {
				if (!org) return;

				// Count by org
				orgCounts[org] = (orgCounts[org] || 0) + 1;

				// Monthly by org
				if (!monthlyByOrg[org]) monthlyByOrg[org] = {};
				monthlyByOrg[org][monthKey] = (monthlyByOrg[org][monthKey] || 0) + 1;
			});

			// Monthly total
			monthlyTotal[monthKey] = (monthlyTotal[monthKey] || 0) + 1;
		});

		// Get all unique months and sort them
		const allMonths = [...new Set([
			...Object.keys(monthlyTotal),
			...Object.values(monthlyByOrg).flatMap(m => Object.keys(m))
		])].sort();

		// Get top 5 organizations
		const top5Orgs = Object.entries(orgCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([org, count]) => ({ org, count }));

		// Format month labels
		const monthLabels = allMonths.map((key) => {
			const [year, month] = key.split('-');
			const date = new Date(parseInt(year), parseInt(month) - 1);
			return {
				key,
				label: date.toLocaleString('default', { month: 'short', year: '2-digit' })
			};
		});

		// Calculate max values for scaling
		const maxMonthlyTotal = Math.max(1, ...Object.values(monthlyTotal));
		const maxOrgCount = top5Orgs.length > 0 ? top5Orgs[0].count : 1;

		// Calculate statistics
		const totalSchools = Object.keys(orgCounts).length;
		const totalRecords = data.length;

		return {
			monthlyByOrg,
			monthlyTotal,
			monthLabels,
			top5Orgs,
			maxMonthlyTotal,
			maxOrgCount,
			allOrgs: Object.keys(orgCounts),
			totalSchools,
			totalRecords
		};
	});

	// Format month labels from month keys
	const fullMonthLabels = $derived.by(() => {
		if (!fullMonthRange || fullMonthRange.length === 0) return [];
		return fullMonthRange.map((key) => {
			const [year, month] = key.split('-');
			const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
			return {
				key,
				label: date.toLocaleString('default', { month: 'short', year: '2-digit' })
			};
		});
	});

	// Use full range for axis if available, otherwise use filtered data's month labels
	const axisMonthLabels = $derived.by(() => {
		return fullMonthLabels.length > 0 ? fullMonthLabels : chartData.monthLabels;
	});

	// Generate SVG path for a line - positions based on axisMonthLabels (full range)
	function getLinePath(monthlyData, dataMonthLabels, axisLabels, maxValue, width, height, padding) {
		if (!monthlyData || dataMonthLabels.length === 0) return '';

		// Create a map from month key to axis position
		const axisPositionMap = new Map();
		axisLabels.forEach((m, i) => {
			axisPositionMap.set(m.key, i);
		});

		// Only plot points for months that have data AND exist in the axis
		const points = dataMonthLabels
			.filter((m) => axisPositionMap.has(m.key))
			.map((m) => {
				const axisIndex = axisPositionMap.get(m.key);
				const x = padding + (axisIndex / (axisLabels.length - 1 || 1)) * (width - 2 * padding);
				const value = monthlyData[m.key] || 0;
				const y = height - padding - (value / maxValue) * (height - 2 * padding);
				return `${x},${y}`;
			});

		if (points.length === 0) return '';
		return `M ${points.join(' L ')}`;
	}

	// Generate circle points for a line - positions based on axisMonthLabels (full range)
	function getCirclePoints(monthlyData, dataMonthLabels, axisLabels, maxValue, width, height, padding) {
		if (!monthlyData || dataMonthLabels.length === 0) return [];

		// Create a map from month key to axis position
		const axisPositionMap = new Map();
		axisLabels.forEach((m, i) => {
			axisPositionMap.set(m.key, i);
		});

		// Only plot points for months that have data AND exist in the axis
		return dataMonthLabels
			.filter((m) => axisPositionMap.has(m.key))
			.map((m) => {
				const axisIndex = axisPositionMap.get(m.key);
				const x = padding + (axisIndex / (axisLabels.length - 1 || 1)) * (width - 2 * padding);
				const value = monthlyData[m.key] || 0;
				const y = height - padding - (value / maxValue) * (height - 2 * padding);
				return { x, y, value, label: m.label };
			});
	}

	const lineChartWidth = 500;
	const lineChartHeight = 220;
	const padding = 50;

	// Bar chart dimensions
	const barChartWidth = 450;
	const barChartHeight = 200;
	const barPadding = { top: 10, right: 20, bottom: 40, left: 140 };
	const barHeight = 24;
	const barGap = 10;

	// Calculate nice axis values for Y axis (line chart)
	const axisValues = $derived(getNiceAxisValues(chartData.maxMonthlyTotal));
	const niceMax = $derived(axisValues[axisValues.length - 1] || chartData.maxMonthlyTotal);

	// Calculate nice axis values for X axis (bar chart)
	const barAxisValues = $derived(getNiceAxisValues(chartData.maxOrgCount));
	const barNiceMax = $derived(barAxisValues[barAxisValues.length - 1] || chartData.maxOrgCount);

	// Pre-compute total line path and points using nice max
	// Uses axisMonthLabels for positioning (full date range) but chartData.monthLabels for data
	const totalPath = $derived(getLinePath(
		chartData.monthlyTotal,
		chartData.monthLabels,
		axisMonthLabels,
		niceMax,
		lineChartWidth,
		lineChartHeight,
		padding
	));

	const totalCirclePoints = $derived(getCirclePoints(
		chartData.monthlyTotal,
		chartData.monthLabels,
		axisMonthLabels,
		niceMax,
		lineChartWidth,
		lineChartHeight,
		padding
	));

	// Handle line chart hover for tooltips
	let chartContainer;

	function handleLinePointHover(point, event) {
		lineTooltip = point;
		if (chartContainer) {
			const rect = chartContainer.getBoundingClientRect();
			lineTooltipX = event.clientX - rect.left;
			lineTooltipY = event.clientY - rect.top - 40;
		}
	}

	function handleLinePointLeave() {
		lineTooltip = null;
	}
</script>

{#if hasChartData}
	<div class="search-charts-container">
		<!-- Stats Header -->
		<div class="charts-stats-header">
			<div class="stat-item">
				<div class="stat-value">{chartData.totalSchools}</div>
				<div class="stat-label">Schools</div>
			</div>
			<div class="stat-item">
				<div class="stat-value">{chartData.totalRecords.toLocaleString()}</div>
				<div class="stat-label">Records</div>
			</div>
		</div>

		<!-- Mobile-only toggle button -->
		<button
			class="charts-toggle mobile-only"
			onclick={() => (isOpen = !isOpen)}
			type="button"
			aria-expanded={isOpen}
		>
			<span class="toggle-text">Charts {isOpen ? '▲' : '▼'}</span>
		</button>

		<!-- Desktop: always visible, Mobile: toggle controlled -->
		<div class="charts-panel-wrapper" class:mobile-open={isOpen}>
			<div class="charts-panel">
				<div class="charts-grid">
					<!-- Line Chart -->
					<div class="chart-section line-chart-section">
						<h4 class="chart-title">Activity Over Time</h4>
						<div class="line-chart-wrapper" bind:this={chartContainer}>
							<svg
								viewBox="0 0 {lineChartWidth} {lineChartHeight}"
								class="line-chart"
								preserveAspectRatio="xMidYMid meet"
							>
								<!-- Horizontal grid lines and Y-axis -->
								{#each axisValues as val, i}
									{@const y = lineChartHeight - padding - (val / niceMax) * (lineChartHeight - 2 * padding)}
									<!-- Grid line -->
									<line
										x1={padding}
										y1={y}
										x2={lineChartWidth - padding}
										y2={y}
										stroke="#f0f0f0"
										stroke-width="1"
									/>
									<!-- Y-axis tick -->
									<line
										x1={padding - 5}
										y1={y}
										x2={padding}
										y2={y}
										stroke="#333"
										stroke-width="1"
									/>
									<!-- Y-axis labels -->
									<text x={padding - 12} y={y + 4} class="axis-label" text-anchor="end">
										{formatAxisNumber(val)}
									</text>
								{/each}
								<!-- Y-axis line -->
								<line
									x1={padding}
									y1={padding}
									x2={padding}
									y2={lineChartHeight - padding}
									stroke="#333"
									stroke-width="1"
								/>

								<!-- X-axis labels and ticks (uses full date range) -->
								{#each axisMonthLabels as m, i}
									{@const x = padding + (i / (axisMonthLabels.length - 1 || 1)) * (lineChartWidth - 2 * padding)}
									<!-- X-axis tick -->
									<line
										x1={x}
										y1={lineChartHeight - padding}
										x2={x}
										y2={lineChartHeight - padding + 5}
										stroke="#333"
										stroke-width="1"
									/>
									<!-- X-axis labels (show fewer to avoid crowding) -->
									{#if i % Math.ceil(axisMonthLabels.length / 5) === 0 || i === axisMonthLabels.length - 1}
										<text x={x} y={lineChartHeight - padding + 18} class="axis-label" text-anchor="middle">
											{m.label}
										</text>
									{/if}
								{/each}
								<!-- X-axis line -->
								<line
									x1={padding}
									y1={lineChartHeight - padding}
									x2={lineChartWidth - padding}
									y2={lineChartHeight - padding}
									stroke="#333"
									stroke-width="1"
								/>

								<!-- Total line (blue) with rounded line caps -->
								<path
									d={totalPath}
									fill="none"
									stroke="#254c6f"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="total-line"
								/>

								<!-- Interactive hover points -->
								{#each totalCirclePoints as point, i}
									<circle
										cx={point.x}
										cy={point.y}
										r="5"
										fill="#254c6f"
										stroke="white"
										stroke-width="2"
										class="data-point"
										onmouseenter={(e) => handleLinePointHover(point, e)}
										onmouseleave={handleLinePointLeave}
									/>
								{/each}
							</svg>

							<!-- Line chart tooltip -->
							{#if lineTooltip}
								<div
									class="line-tooltip"
									style="left: {lineTooltipX}px; top: {lineTooltipY}px;"
								>
									<div class="tooltip-date">{lineTooltip.label}</div>
									<div class="tooltip-value">{lineTooltip.value.toLocaleString()} announcements</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Bar Chart - Top 5 Schools -->
					<div class="chart-section bar-chart-section">
						<h4 class="chart-title">Top 5 Schools</h4>
						<div class="bar-chart-wrapper">
							<svg
								viewBox="0 0 {barChartWidth} {barChartHeight}"
								class="bar-chart-svg"
								preserveAspectRatio="xMidYMid meet"
							>
								<!-- Vertical grid lines and X-axis -->
								{#each barAxisValues as val, i}
									{@const x = barPadding.left + (val / barNiceMax) * (barChartWidth - barPadding.left - barPadding.right)}
									<!-- Grid line -->
									<line
										x1={x}
										y1={barPadding.top}
										x2={x}
										y2={barChartHeight - barPadding.bottom}
										stroke="#f0f0f0"
										stroke-width="1"
									/>
									<!-- X-axis tick -->
									<line
										x1={x}
										y1={barChartHeight - barPadding.bottom}
										x2={x}
										y2={barChartHeight - barPadding.bottom + 5}
										stroke="#333"
										stroke-width="1"
									/>
									<!-- X-axis labels -->
									<text x={x} y={barChartHeight - barPadding.bottom + 18} class="axis-label" text-anchor="middle">
										{formatAxisNumber(val)}
									</text>
								{/each}
								<!-- X-axis line -->
								<line
									x1={barPadding.left}
									y1={barChartHeight - barPadding.bottom}
									x2={barChartWidth - barPadding.right}
									y2={barChartHeight - barPadding.bottom}
									stroke="#333"
									stroke-width="1"
								/>
								<!-- Y-axis line -->
								<line
									x1={barPadding.left}
									y1={barPadding.top}
									x2={barPadding.left}
									y2={barChartHeight - barPadding.bottom}
									stroke="#333"
									stroke-width="1"
								/>

								<!-- Bars -->
								{#each chartData.top5Orgs as { org, count }, i}
									{@const barWidth = (count / barNiceMax) * (barChartWidth - barPadding.left - barPadding.right)}
									{@const y = barPadding.top + i * (barHeight + barGap)}
									<g
										class="bar-group"
										onmouseenter={() => (hoveredOrg = org)}
										onmouseleave={() => (hoveredOrg = null)}
										role="button"
										tabindex="0"
										onfocus={() => (hoveredOrg = org)}
										onblur={() => (hoveredOrg = null)}
									>
										<!-- Organization label (on the left) -->
										<text
											x={barPadding.left - 8}
											y={y + barHeight / 2 + 4}
											class="bar-org-label-svg"
											text-anchor="end"
										>
											{org.length > 18 ? org.substring(0, 18) + '...' : org}
										</text>
										<!-- Bar background track -->
										<rect
											x={barPadding.left}
											y={y}
											width={barChartWidth - barPadding.left - barPadding.right}
											height={barHeight}
											fill="#f0f0f0"
											rx="4"
										/>
										<!-- Bar fill -->
										<rect
											x={barPadding.left}
											y={y}
											width={barWidth}
											height={barHeight}
											fill={hoveredOrg === org ? '#1a3a52' : '#254c6f'}
											rx="4"
											class="bar-fill-rect"
										/>
									</g>
								{/each}
							</svg>

							<!-- Tooltip -->
							{#if hoveredOrg}
								{@const hoveredData = chartData.top5Orgs.find(d => d.org === hoveredOrg)}
								{@const hoveredIndex = chartData.top5Orgs.findIndex(d => d.org === hoveredOrg)}
								{#if hoveredData}
									<div
										class="bar-tooltip"
										style="top: {barPadding.top + hoveredIndex * (barHeight + barGap) - 40}px; left: calc(50% + 70px);"
									>
										<div class="tooltip-org">{hoveredData.org}</div>
										<div class="tooltip-count">{hoveredData.count.toLocaleString()} announcements</div>
									</div>
								{/if}
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.search-charts-container {
		width: 100%;
		margin-top: 1rem;
		border: 1px solid #e0e0e0;
		background: white;
		box-sizing: border-box;
	}

	/* Stats Header */
	.charts-stats-header {
		display: flex;
		gap: 1.5rem;
		padding: 0.75rem 1rem;
		background: #fafafa;
		border-bottom: 1px solid #e0e0e0;
		box-sizing: border-box;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: #254c6f;
	}

	.stat-label {
		font-size: 0.7rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.charts-toggle {
		width: 100%;
		padding: 0.75rem 1rem;
		background: #FFFFFF;
		border: none;
		border-bottom: 1px solid #e0e0e0;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 500;
		color: #254c6f;
		text-align: left;
		display: none;
		justify-content: space-between;
		align-items: center;
	}

	.charts-toggle:hover {
		background: #f0f0f0;
	}

	/* Desktop: always show charts, hide toggle */
	.charts-panel-wrapper {
		display: block;
	}

	/* Mobile styles - show toggle and hide charts by default */
	@media (max-width: 768px) {
		.charts-toggle.mobile-only {
			display: flex;
		}

		.charts-panel-wrapper {
			display: none;
		}

		.charts-panel-wrapper.mobile-open {
			display: block;
		}
	}

	.charts-panel {
		padding: 1rem;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.chart-section {
		width: 100%;
	}

	.line-chart-section {
		min-width: 0;
	}

	.bar-chart-section {
		min-width: 0;
	}

	.chart-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 1rem 0;
	}

	/* Line Chart */
	.line-chart-wrapper {
		width: 100%;
		background: #FFFFFF;
		border-radius: 0px;
		padding: 1rem;
		box-sizing: border-box;
		position: relative;
	}

	.line-chart {
		width: 100%;
		height: auto;
		display: block;
	}

	.axis-label {
		font-size: 11px;
		fill: #888;
	}

	.total-line {
		filter: none;
	}

	.data-point {
		cursor: pointer;
		transition: r 0.15s ease;
	}

	.data-point:hover {
		r: 7;
	}

	/* Line chart tooltip */
	.line-tooltip {
		position: absolute;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		pointer-events: none;
		z-index: 100;
		transform: translateX(-50%);
	}

	.line-tooltip .tooltip-date {
		font-size: 0.75rem;
		font-weight: 600;
		color: #254c6f;
		margin-bottom: 2px;
	}

	.line-tooltip .tooltip-value {
		font-size: 0.7rem;
		color: #666;
	}

	/* Bar Chart */
	.bar-chart-wrapper {
		width: 100%;
		background: #FFFFFF;
		border-radius: 4px;
		padding: 1rem;
		box-sizing: border-box;
		position: relative;
	}

	.bar-chart-svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.bar-group {
		cursor: pointer;
	}

	.bar-group:focus {
		outline: none;
	}

	.bar-group:focus .bar-fill-rect {
		stroke: #254c6f;
		stroke-width: 2;
	}

	.bar-fill-rect {
		transition: fill 0.2s ease;
	}

	.bar-org-label-svg {
		font-size: 11px;
		fill: #1a1a1a;
	}

	/* Bar tooltip */
	.bar-tooltip {
		position: absolute;
		transform: translateX(-50%);
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		pointer-events: none;
		z-index: 100;
		white-space: nowrap;
	}

	.bar-tooltip .tooltip-org {
		font-size: 0.75rem;
		font-weight: 600;
		color: #254c6f;
		margin-bottom: 2px;
	}

	.bar-tooltip .tooltip-count {
		font-size: 0.7rem;
		color: #666;
	}

	@media (max-width: 768px) {
		.charts-panel {
			padding: 1rem;
		}

		.charts-grid {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.bar-chart-wrapper {
			padding: 0.75rem;
		}

		.bar-org-label-svg {
			font-size: 10px;
		}
	}
</style>
