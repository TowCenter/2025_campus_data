<script>
	import { onMount } from 'svelte';
	import { parseDate } from './date-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {any[]} [data=[]] - Filtered data array
	 * @property {string} [dateField='date'] - Field name for dates
	 * @property {string} [orgField='org'] - Field name for organization
	 * @property {string} [searchQuery=''] - Current search query
	 * @property {boolean} [isOpen=false] - Whether the charts panel is open
	 * @property {any} [stats=null] - Precomputed chart stats (optional)
	 * @property {string[]} [allMonths=[]] - All available months for static x-axis
	 */

	/** @type {Props} */
	let {
		data = [],
		dateField = 'date',
		orgField = 'org',
		searchQuery = '',
		isOpen = $bindable(true), // Default to open on mobile
		stats = null,
		allMonths = []
	} = $props();

	// Track if user has manually toggled
	let userToggled = $state(false);
	
	// Auto-open when there's a search query (but allow manual toggle)
	$effect(() => {
		if (searchQuery && searchQuery.length > 0 && !userToggled) {
			isOpen = true;
		}
	});
	
	// Handle toggle click
	function handleToggle() {
		userToggled = true;
		isOpen = !isOpen;
	}
	
	// On mount, check if we're on mobile and set default state
	onMount(() => {
		// Default to open on mobile (charts start open)
		if (typeof window !== 'undefined' && window.innerWidth <= 767) {
			isOpen = true;
		}
	});

	const hasChartData = $derived.by(() => {
		// Always show charts container - it will display stats when available
		// This ensures graphs show on load with all data stats, even when there's no search
		
		// If stats is provided (even if null initially), show charts
		// The stats prop being passed means charts should be visible
		if (stats !== undefined) {
			// If stats has data, definitely show
			if (stats && typeof stats.totalRecords === 'number' && stats.totalRecords > 0) {
				return true;
			}
			if (stats && stats.monthlyCounts && Object.keys(stats.monthlyCounts).length > 0) {
				return true;
			}
			if (stats && stats.institutionCounts && Object.keys(stats.institutionCounts).length > 0) {
				return true;
			}
			if (stats && Array.isArray(stats.topInstitutions) && stats.topInstitutions.length > 0) {
				return true;
			}
			// Even if stats is null or empty, show charts (they'll populate when data loads)
			// This ensures the container is visible even when there's no search
			return true;
		}
		// Fall back to data length if stats prop is not provided at all
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
			
			// Use all available months for static x-axis, or fall back to months with data
			const monthKeys = allMonths.length > 0 
				? [...allMonths].sort() 
				: Object.keys(monthlyTotal).sort();
			
			const monthLabels = monthKeys.map((key) => {
				const [year, month] = key.split('-');
				const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
				return {
					key,
					label: date.toLocaleString('default', { month: 'short', year: '2-digit' })
				};
			});
			
			// Fill in 0 values for months that don't have data
			const filledMonthlyTotal = {};
			monthKeys.forEach(key => {
				filledMonthlyTotal[key] = monthlyTotal[key] || 0;
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
				monthlyTotal: filledMonthlyTotal,
				monthLabels,
				top5Orgs,
				maxMonthlyTotal: Math.max(1, ...Object.values(filledMonthlyTotal)),
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

		// Get all unique months - use provided allMonths for static x-axis, or derive from data
		const dataMonths = [...new Set([
			...Object.keys(monthlyTotal),
			...Object.values(monthlyByOrg).flatMap(m => Object.keys(m))
		])].sort();
		
		const chartMonths = allMonths.length > 0 ? [...allMonths].sort() : dataMonths;

		// Get top 5 organizations
		const top5Orgs = Object.entries(orgCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([org, count]) => ({ org, count }));

		// Format month labels
		const monthLabels = chartMonths.map((key) => {
			const [year, month] = key.split('-');
			const date = new Date(parseInt(year), parseInt(month) - 1);
			return {
				key,
				label: date.toLocaleString('default', { month: 'short', year: '2-digit' })
			};
		});
		
		// Fill in 0 values for months that don't have data
		const filledMonthlyTotal = {};
		chartMonths.forEach(key => {
			filledMonthlyTotal[key] = monthlyTotal[key] || 0;
		});

		// Calculate max values for scaling
		const maxMonthlyTotal = Math.max(1, ...Object.values(filledMonthlyTotal));
		const maxOrgCount = top5Orgs.length > 0 ? top5Orgs[0].count : 1;

		// Calculate statistics
		const totalSchools = Object.keys(orgCounts).length;
		const totalRecords = data.length;

		return {
			monthlyByOrg,
			monthlyTotal: filledMonthlyTotal,
			monthLabels,
			top5Orgs,
			maxMonthlyTotal,
			maxOrgCount,
			allOrgs: Object.keys(orgCounts),
			totalSchools,
			totalRecords
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

	const lineChartWidth = 500;
	const lineChartHeight = 220;
	const padding = 40;

	// Bar chart dimensions
	// Calculate left padding based on longest university name
	const maxOrgNameLength = $derived.by(() => {
		if (!chartData.top5Orgs || chartData.top5Orgs.length === 0) return 140;
		return Math.max(...chartData.top5Orgs.map(d => d.org.length));
	});
	// Estimate: ~7px per character + some padding
	const calculatedLeftPadding = $derived(Math.max(140, maxOrgNameLength * 7 + 20));
	const barChartWidth = $derived(450 + (calculatedLeftPadding - 140));
	const barChartHeight = 220; // Match line chart height
	const barPadding = $derived({ top: 10, right: 5, bottom: 10, left: calculatedLeftPadding });
	const barHeight = 28;
	const barGap = 12;

	// Calculate nice axis values for Y axis (line chart)
	const axisValues = $derived(getNiceAxisValues(chartData.maxMonthlyTotal));
	const niceMax = $derived(axisValues[axisValues.length - 1] || chartData.maxMonthlyTotal);

	// Calculate nice axis values for X axis (bar chart)
	const barAxisValues = $derived(getNiceAxisValues(chartData.maxOrgCount));
	const barNiceMax = $derived(barAxisValues[barAxisValues.length - 1] || chartData.maxOrgCount);

	// Pre-compute total line path and points using nice max
	const totalPath = $derived(getLinePath(
		chartData.monthlyTotal,
		chartData.monthLabels,
		niceMax,
		lineChartWidth,
		lineChartHeight,
		padding
	));

	const totalCirclePoints = $derived(getCirclePoints(
		chartData.monthlyTotal,
		chartData.monthLabels,
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
				<div class="stat-value">{chartData.totalRecords.toLocaleString()}</div>
				<div class="stat-label">Records</div>
			</div>
			<div class="stat-item">
				<div class="stat-value">{chartData.totalSchools}</div>
				<div class="stat-label">Schools</div>
			</div>
		</div>

		<!-- Mobile-only toggle button -->
		<button
			class="charts-toggle mobile-only"
			onclick={handleToggle}
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

								<!-- X-axis labels and ticks -->
								{#each chartData.monthLabels as m, i}
									{@const x = padding + (i / (chartData.monthLabels.length - 1 || 1)) * (lineChartWidth - 2 * padding)}
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
									{@const labelInterval = Math.max(1, Math.ceil(chartData.monthLabels.length / 6))}
									{#if i % labelInterval === 0}
										<text x={x} y={lineChartHeight - padding + 22} class="axis-label x-axis-label" text-anchor="middle">
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
								<!-- Bars -->
								{#each chartData.top5Orgs as { org, count }, i}
									{@const maxBarWidth = barChartWidth - barPadding.left - barPadding.right}
									{@const barWidth = Math.min((count / barNiceMax) * maxBarWidth, maxBarWidth)}
									{@const y = barPadding.top + i * (barHeight + barGap)}
									{@const barCenterY = y + barHeight / 2}
									<g class="bar-group">
										<!-- Organization label (on the left) -->
										<text
											x={barPadding.left - 8}
											y={barCenterY}
											class="bar-org-label-svg"
											text-anchor="end"
											dominant-baseline="middle"
										>
											{org}
										</text>
										<!-- Bar fill -->
										<rect
											x={barPadding.left}
											y={y}
											width={barWidth}
											height={barHeight}
											fill="#254c6f"
											rx="0"
											class="bar-fill-rect"
										/>
										<!-- Value label inside bar -->
										{#if barWidth > 50}
											<text
												x={barPadding.left + barWidth - 8}
												y={barCenterY}
												class="bar-value-label"
												text-anchor="end"
												dominant-baseline="middle"
												fill="white"
											>
												{count.toLocaleString()}
											</text>
										{:else}
											<!-- If bar is too narrow, put label outside -->
											<text
												x={barPadding.left + barWidth + 8}
												y={barCenterY}
												class="bar-value-label-outside"
												text-anchor="start"
												dominant-baseline="middle"
												fill="#666"
											>
												{count.toLocaleString()}
											</text>
										{/if}
									</g>
								{/each}
							</svg>
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
		gap: 2rem;
		padding: 1rem 1.5rem;
		background: #fafafa;
		border-bottom: 1px solid #e0e0e0;
		box-sizing: border-box;
		align-items: center;
	}

	@media screen and (max-width: 767px) {
		.charts-stats-header {
			padding: 1rem;
			gap: 1.5rem;
		}
	}

	.stat-item {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: 0.5rem;
		position: relative;
	}

	.stat-item:not(:last-child)::after {
		content: '';
		position: absolute;
		right: -1rem;
		top: 50%;
		transform: translateY(-50%);
		width: 1px;
		height: 1.5rem;
		background-color: #e0e0e0;
	}

	@media screen and (max-width: 767px) {
		.stat-item:not(:last-child)::after {
			right: -0.75rem;
		}
	}

	.stat-value {
		font-size: 1rem;
		font-weight: 600;
		color: #254c6f;
		white-space: nowrap;
		font-family: 'Graphik Web', 'Helvetica', sans-serif;
		line-height: 1.2;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		white-space: nowrap;
		font-family: 'Graphik Web', 'Helvetica', sans-serif;
		font-weight: 500;
		line-height: 1.2;
	}

	@media screen and (max-width: 767px) {
		.stat-value {
			font-size: 0.9rem;
		}
		
		.stat-label {
			font-size: 0.7rem;
		}
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

	/* Mobile styles - show toggle and show charts by default */
	@media (max-width: 767px) {
		.search-charts-container {
			margin: 0;
			padding: 0;
			width: 100%;
		}

		.charts-toggle.mobile-only {
			display: flex;
			min-height: 44px;
			padding: 0.75rem 1rem;
			touch-action: manipulation;
		}

		.charts-panel-wrapper {
			display: none;
		}
		.charts-panel-wrapper.mobile-open {
			display: block;
		}
	}
	@media (min-width: 768px) and (max-width: 1024px) {
		.search-charts-container {
			margin: 0;
			padding: 0;
			width: 100%;
		}

		.charts-panel-wrapper.mobile-open {
			display: block;
	}

	.charts-panel {
		padding: 1rem;
		}
		.charts-stats-header {
			padding: 0.75rem 1rem;
		}

		.charts-grid {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.chart-title {
			font-size: 0.8rem;
			margin-bottom: 0.75rem;
		}
	}

	.charts-panel {
		padding: 0.5rem;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.chart-section {
		width: 100%;
	}

	.line-chart-section {
		min-width: 0;
	}

	.bar-chart-section {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.chart-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0.75rem 0 0.5rem 0;
		text-align: center;
	}

	/* Line Chart */
	.line-chart-wrapper {
		width: 100%;
		background: #FFFFFF;
		border-radius: 0px;
		padding: 0;
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

	.x-axis-label {
		font-size: 10px;
		fill: #666;
		letter-spacing: 0.5px;
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
		padding: 0;
		box-sizing: border-box;
		position: relative;
		overflow: visible;
		height: 220px;
		display: flex;
		align-items: center;
	}

	.bar-chart-svg {
		width: 100%;
		height: 220px;
		display: block;
		overflow: visible;
	}

	.bar-group {
		pointer-events: none;
	}

	.bar-fill-rect {
		transition: fill 0.2s ease;
	}

	.bar-org-label-svg {
		font-size: 11px;
		fill: #1a1a1a;
	}

	.bar-value-label {
		font-size: 11px;
		font-weight: 600;
		pointer-events: none;
	}

	.bar-value-label-outside {
		font-size: 11px;
		font-weight: 500;
		pointer-events: none;
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

	@media (max-width: 767px) {
		.charts-panel {
			padding: 0.5rem;
		}
		.charts-stats-header {
			padding: 0.75rem 1rem;
		}

		.charts-grid {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.bar-chart-wrapper {
			padding: 0;
			height: 200px;
		}

		.bar-chart-svg {
			width: 100%;
			height: 200px;
		}

		.bar-org-label-svg {
			font-size: 10px;
		}
	}
	@media (min-width: 768px) and (max-width: 1024px) {
		.charts-panel {
			padding: 0.5rem;
		}
	}
</style>
