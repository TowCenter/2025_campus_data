<script>
	import { parseDate } from './date-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {any[]} [data=[]] - Data array
	 * @property {string} [dateField='date'] - Field name in data that contains dates
	 * @property {number} [maxBars=12] - Maximum number of bars to show (most recent periods)
	 */

	/** @type {Props} */
	let {
		data = [],
		dateField = 'date',
		maxBars = 12
	} = $props();

	// Group data by month and year
	const chartData = $derived.by(() => {
		const groups = {};
		
		data.forEach((item) => {
			const dateValue = item[dateField];
			if (!dateValue) return;
			
			const dateObj = parseDate(dateValue);
			if (isNaN(dateObj.getTime())) return;
			
			const month = dateObj.toLocaleString('default', { month: 'short' });
			const year = dateObj.getFullYear();
			const key = `${month} ${year}`;
			
			groups[key] = (groups[key] || 0) + 1;
		});

		// Convert to array and sort by date (newest first)
		const entries = Object.entries(groups).map(([label, count]) => {
			// Parse the label to get date for sorting
			const [monthName, yearStr] = label.split(' ');
			const year = parseInt(yearStr, 10);
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const monthIndex = monthNames.indexOf(monthName);
			const date = new Date(year, monthIndex, 1);
			
			return { label, count, date };
		});

		// Sort by date descending (newest first) and take most recent
		entries.sort((a, b) => b.date.getTime() - a.date.getTime());
		
		return entries.slice(0, maxBars).reverse(); // Reverse to show oldest to newest
	});

	// Find max count for scaling
	const maxCount = $derived.by(() => {
		if (chartData.length === 0) return 1;
		return Math.max(...chartData.map(d => d.count));
	});
</script>

{#if chartData.length > 0}
	<div class="bar-chart-container">
		<h3 class="chart-title">Activity Over Time</h3>
		<div class="chart-wrapper">
			<div class="chart-bars">
				{#each chartData as { label, count }}
					{@const height = maxCount > 0 ? (count / maxCount) * 100 : 0}
					<div class="bar-item">
						<div class="bar-wrapper">
							<div class="bar" style="height: {height}%">
								<span class="bar-value">{count}</span>
							</div>
						</div>
						<div class="bar-label">{label}</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.bar-chart-container {
		max-width: 900px;
		margin: 3rem auto;
		padding: 0 15px;
	}

	.chart-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1a1a1a;
		margin-bottom: 1.5rem;
		margin-top: 0;
	}

	.chart-wrapper {
		width: 100%;
		overflow-x: auto;
	}

	.chart-bars {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
		min-height: 220px;
		padding-bottom: 3rem;
	}

	.bar-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 50px;
	}

	.bar-wrapper {
		width: 100%;
		height: 220px;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		margin-bottom: 0.5rem;
	}

	.bar {
		width: 100%;
		max-width: 36px;
		background-color: #254c6f;
		border-radius: 0;
		position: relative;
		transition: opacity 0.2s ease;
		min-height: 4px;
	}

	.bar:hover {
		opacity: 0.8;
	}

	.bar-value {
		position: absolute;
		top: -1.75rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.8125rem;
		font-weight: 500;
		color: #1a1a1a;
		white-space: nowrap;
	}

	.bar-label {
		font-size: 0.75rem;
		color: #666;
		text-align: center;
		transform: rotate(-45deg);
		transform-origin: center;
		white-space: nowrap;
		margin-top: 0.5rem;
		width: 100%;
		height: 60px;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 0.25rem;
	}

	@media (max-width: 768px) {
		.bar-chart-container {
			margin: 2rem auto;
			padding: 0 1rem;
		}

		.chart-title {
			font-size: 1rem;
			margin-bottom: 1rem;
		}

		.chart-bars {
			min-height: 180px;
			gap: 0.5rem;
			padding-bottom: 2.5rem;
		}

		.bar-wrapper {
			height: 180px;
		}

		.bar {
			max-width: 28px;
		}

		.bar-value {
			font-size: 0.6875rem;
			top: -1.5rem;
		}

		.bar-label {
			font-size: 0.6875rem;
			height: 50px;
		}
	}
</style>
