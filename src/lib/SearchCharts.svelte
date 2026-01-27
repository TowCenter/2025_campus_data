<script>
	import { parseDate } from './date-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {any[]} [data=[]] - Filtered data array
	 * @property {string} [dateField='date'] - Field name for dates
	 * @property {string} [orgField='org'] - Field name for organization
	 * @property {string} [searchQuery=''] - Current search query
	 * @property {boolean} [isOpen=false] - Whether the charts panel is open
	 */

	/** @type {Props} */
	let {
		data = [],
		dateField = 'date',
		orgField = 'org',
		searchQuery = '',
		isOpen = $bindable(false)
	} = $props();

	// Auto-open when there's a search query
	$effect(() => {
		if (searchQuery && searchQuery.length > 0) {
			isOpen = true;
		}
	});

	// Track which organization is being hovered
	let hoveredOrg = $state(null);

	// Process data for charts
	const chartData = $derived.by(() => {
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
		const maxMonthlyTotal = Math.max(...Object.values(monthlyTotal), 1);
		const maxOrgCount = top5Orgs.length > 0 ? top5Orgs[0].count : 1;

		return {
			monthlyByOrg,
			monthlyTotal,
			monthLabels,
			top5Orgs,
			maxMonthlyTotal,
			maxOrgCount,
			allOrgs: Object.keys(orgCounts)
		};
	});

	// Generate SVG path for a line
	function getLinePath(monthlyData, monthLabels, maxValue, width, height, padding) {
		if (!monthlyData || monthLabels.length === 0) return '';

		const points = monthLabels.map((m, i) => {
			const x = padding + (i / (monthLabels.length - 1 || 1)) * (width - 2 * padding);
			const value = monthlyData[m.key] || 0;
			const y = height - padding - (value / maxValue) * (height - 2 * padding);
			return `${x},${y}`;
		});

		return `M ${points.join(' L ')}`;
	}

	// Generate circle points for a line
	function getCirclePoints(monthlyData, monthLabels, maxValue, width, height, padding) {
		if (!monthlyData || monthLabels.length === 0) return [];

		return monthLabels.map((m, i) => {
			const x = padding + (i / (monthLabels.length - 1 || 1)) * (width - 2 * padding);
			const value = monthlyData[m.key] || 0;
			const y = height - padding - (value / maxValue) * (height - 2 * padding);
			return { x, y, value, label: m.label };
		});
	}

	const lineChartWidth = 800;
	const lineChartHeight = 200;
	const padding = 40;

	// Pre-compute total line path and points
	const totalPath = $derived(getLinePath(
		chartData.monthlyTotal,
		chartData.monthLabels,
		chartData.maxMonthlyTotal,
		lineChartWidth,
		lineChartHeight,
		padding
	));

	const totalCirclePoints = $derived(getCirclePoints(
		chartData.monthlyTotal,
		chartData.monthLabels,
		chartData.maxMonthlyTotal,
		lineChartWidth,
		lineChartHeight,
		padding
	));
</script>

{#if data.length > 0}
	<div class="search-charts-container">
		<button
			class="charts-toggle"
			onclick={() => (isOpen = !isOpen)}
			type="button"
			aria-expanded={isOpen}
		>
			<span class="toggle-text">Charts {isOpen ? '▲' : '▼'}</span>
		</button>

		{#if isOpen}
			<div class="charts-panel">
				<!-- Line Chart -->
				<div class="chart-section">
					<h4 class="chart-title">Activity Over Time</h4>
					<div class="line-chart-wrapper">
						<svg
							viewBox="0 0 {lineChartWidth} {lineChartHeight}"
							class="line-chart"
							preserveAspectRatio="xMidYMid meet"
						>
							<!-- Y-axis -->
							<line
								x1={padding}
								y1={padding}
								x2={padding}
								y2={lineChartHeight - padding}
								stroke="#e0e0e0"
								stroke-width="1"
							/>

							<!-- X-axis -->
							<line
								x1={padding}
								y1={lineChartHeight - padding}
								x2={lineChartWidth - padding}
								y2={lineChartHeight - padding}
								stroke="#e0e0e0"
								stroke-width="1"
							/>

							<!-- Y-axis labels -->
							<text x={padding - 10} y={padding} class="axis-label" text-anchor="end">
								{chartData.maxMonthlyTotal}
							</text>
							<text x={padding - 10} y={lineChartHeight - padding} class="axis-label" text-anchor="end">
								0
							</text>

							<!-- X-axis labels -->
							{#each chartData.monthLabels as m, i}
								{#if i % Math.ceil(chartData.monthLabels.length / 6) === 0 || i === chartData.monthLabels.length - 1}
									{@const x = padding + (i / (chartData.monthLabels.length - 1 || 1)) * (lineChartWidth - 2 * padding)}
									<text x={x} y={lineChartHeight - padding + 20} class="axis-label" text-anchor="middle">
										{m.label}
									</text>
								{/if}
							{/each}

							<!-- Organization lines (grey) -->
							{#each chartData.allOrgs as org}
								{@const isHovered = hoveredOrg === org}
								{@const path = getLinePath(
									chartData.monthlyByOrg[org],
									chartData.monthLabels,
									chartData.maxMonthlyTotal,
									lineChartWidth,
									lineChartHeight,
									padding
								)}
								<path
									d={path}
									fill="none"
									stroke={isHovered ? '#254c6f' : '#d0d0d0'}
									stroke-width={isHovered ? 2.5 : 1}
									class="org-line"
									class:highlighted={isHovered}
								/>
							{/each}

							<!-- Total line (blue) -->
							<path
								d={totalPath}
								fill="none"
								stroke="#254c6f"
								stroke-width="2.5"
								class="total-line"
							/>

							<!-- Total line circles -->
							{#each totalCirclePoints as point}
								<circle
									cx={point.x}
									cy={point.y}
									r="4"
									fill="#254c6f"
									class="data-point"
								>
									<title>{point.label}: {point.value}</title>
								</circle>
							{/each}
						</svg>
					</div>
					<div class="chart-legend">
						<span class="legend-item">
							<span class="legend-line total"></span>
							Total
						</span>
						<span class="legend-item">
							<span class="legend-line org"></span>
							Individual Schools
						</span>
					</div>
				</div>

				<!-- Bar Chart - Top 5 Organizations -->
				<div class="chart-section">
					<h4 class="chart-title">Top 5 Organizations</h4>
					<div class="bar-chart">
						{#each chartData.top5Orgs as { org, count }}
							{@const widthPercent = (count / chartData.maxOrgCount) * 100}
							<div
								class="bar-row"
								onmouseenter={() => (hoveredOrg = org)}
								onmouseleave={() => (hoveredOrg = null)}
								role="button"
								tabindex="0"
								onfocus={() => (hoveredOrg = org)}
								onblur={() => (hoveredOrg = null)}
							>
								<div class="bar-label-container">
									<span class="bar-org-label" title={org}>{org}</span>
								</div>
								<div class="bar-track">
									<div
										class="bar-fill"
										class:highlighted={hoveredOrg === org}
										style="width: {widthPercent}%"
									></div>
								</div>
								<span class="bar-count">{count}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.search-charts-container {
		width: 100%;
		margin-top: 1rem;
		border: 1px solid #e0e0e0;
		background: white;
	}

	.charts-toggle {
		width: 100%;
		padding: 0.75rem 1rem;
		background: #fafafa;
		border: none;
		border-bottom: 1px solid #e0e0e0;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 500;
		color: #254c6f;
		text-align: left;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.charts-toggle:hover {
		background: #f0f0f0;
	}

	.charts-panel {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.chart-section {
		width: 100%;
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
		background: #fafafa;
		border-radius: 0;
		padding: 1rem;
		box-sizing: border-box;
	}

	.line-chart {
		width: 100%;
		height: auto;
		display: block;
	}

	.axis-label {
		font-size: 11px;
		fill: #666;
	}

	.org-line {
		transition: stroke 0.2s ease, stroke-width 0.2s ease;
	}

	.org-line.highlighted {
		stroke: #254c6f;
		stroke-width: 2.5;
	}

	.total-line {
		filter: none;
	}

	.data-point {
		cursor: pointer;
	}

	.chart-legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 0.75rem;
		font-size: 0.75rem;
		color: #666;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.legend-line {
		width: 20px;
		height: 2px;
	}

	.legend-line.total {
		background: #254c6f;
		height: 2.5px;
	}

	.legend-line.org {
		background: #d0d0d0;
	}

	/* Bar Chart */
	.bar-chart {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bar-row {
		display: grid;
		grid-template-columns: 180px 1fr 50px;
		gap: 1rem;
		align-items: center;
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.bar-row:hover .bar-fill {
		background: #1a3a52;
	}

	.bar-row:focus {
		outline: 2px solid #254c6f;
		outline-offset: 2px;
	}

	.bar-label-container {
		overflow: hidden;
	}

	.bar-org-label {
		font-size: 0.8rem;
		color: #1a1a1a;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.bar-track {
		height: 24px;
		background: #f0f0f0;
		position: relative;
	}

	.bar-fill {
		height: 100%;
		background: #254c6f;
		transition: width 0.3s ease, background 0.2s ease;
	}

	.bar-fill.highlighted {
		background: #1a3a52;
	}

	.bar-count {
		font-size: 0.8rem;
		font-weight: 500;
		color: #1a1a1a;
		text-align: right;
	}

	@media (max-width: 768px) {
		.charts-panel {
			padding: 1rem;
		}

		.bar-row {
			grid-template-columns: 120px 1fr 40px;
			gap: 0.5rem;
		}

		.bar-org-label {
			font-size: 0.7rem;
		}

		.bar-track {
			height: 20px;
		}

		.chart-legend {
			flex-wrap: wrap;
			gap: 1rem;
		}
	}
</style>
