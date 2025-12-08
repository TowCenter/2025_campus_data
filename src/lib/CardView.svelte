<script>
	import Card from './Card.svelte';
	import { filterData } from './filter-utils.js';
	import { groupByMonth } from './date-utils.js';
	import { parseDate } from './date-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Array<Object>} [data=[]] - Card data rows
	 * @property {string[]} [columns=[]] - Column names (for filtering/search compatibility)
	 * @property {string} [searchQuery=''] - Search query string
	 * @property {string[]} [filterInteraction=[]] - Filter by interactions
	 * @property {string[]} [filterType=[]] - Filter by types
	 * @property {string[]} [filterPlatform=[]] - Filter by platforms
	 * @property {string[]} [filterPublishers=[]] - Filter by publishers
	 * @property {(data: Array<Object>) => void} [onFilteredDataChange=() => {}] - Callback when filtered data changes
	 */

	/** @type {Props} */
	let { 
		data = [], 
		columns = [],
		searchQuery = '',
		filterInteraction = [],
		filterType = [],
		filterPlatform = [],
		filterPublishers = [],
		onFilteredDataChange = () => {}
	} = $props();

	/**
	 * Filters and sorts data based on current filters
	 */
	const filteredData = $derived.by(() => {
		const filtered = filterData(data, {
			searchQuery,
			filterInteraction,
			filterType,
			filterPlatform,
			filterPublishers
		});

		// Sort by date descending (newest first)
		filtered.sort((a, b) => {
			const aDate = parseDate(a.date);
			const bDate = parseDate(b.date);
			return bDate.getTime() - aDate.getTime();
		});

		return filtered;
	});

	const groupedData = $derived(groupByMonth(filteredData));

	$effect(() => {
		onFilteredDataChange(filteredData);
	});
</script>

<div class="card-view">
	<div class="timeline-container">
		{#each Object.entries(groupedData) as [monthYear, items]}
			<div class="timeline-row">
				<div class="month-label">
					<span>{monthYear.split(' ')[0]}</span>
					<span class="year-label">{monthYear.split(' ')[1]}</span>
				</div>
				<div class="timeline-divider"></div>
				<div class="month-group">
					{#each items as row, rowIndex (row)}
						{@const cardId = `${monthYear}-${rowIndex}-${row.date || ''}`}
						<Card 
							{row}
							{cardId}
							{searchQuery}
							{filterPublishers}
						/>
													{/each}
											</div>
			</div>
		{/each}
		{#if filteredData.length === 0}
			<div class="no-results">
				No results found
			</div>
		{/if}
	</div>
</div>

<style>
	.card-view {
		width: 100%;
		margin-top: 1rem;
	}

	.timeline-container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 0 3rem 4rem;
		overflow: visible;
		position: relative;
	}

	.timeline-row {
		display: grid;
		grid-template-columns: 100px 2px 1fr;
		gap: 2rem;
		align-items: flex-start;
		margin-bottom: 4rem;
		overflow: visible;
		overflow-x: visible;
	}

	.timeline-divider {
		background: #e0e0e0;
		width: 1.5px;
		height: 100%;
		opacity: 1;
	}

	.month-label {
		font-family: inherit;
		font-size: 1.5rem;
		font-weight: 600;
		color: #1a1a1a;
		text-transform: capitalize;
		position: sticky;
		top: calc(200px + 1rem);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-right: 0.5rem;
		margin-right: -1rem;
		z-index: 900;
		padding-top: 0.5rem;
		line-height: 1.2;
	}

	.year-label {
		font-size: 1rem;
		color: #666;
		margin-top: 0.25rem;
		font-weight: 400;
	}

	.month-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: visible;
		overflow-x: visible;
		min-width: 0;
		width: 100%;
	}

	.no-results {
		grid-column: 1 / -1;
		text-align: center;
		color: #999;
		padding: 3rem;
		font-style: italic;
		background-color: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
	}

	@media screen and (max-width: 768px) {
		.timeline-container {
			padding: 0 1rem 2rem;
		}

		.timeline-row {
		display: flex;
		flex-direction: column;
			margin-bottom: 2rem;
			gap: 0;
		}

		.timeline-divider {
			display: none;
		}

		.month-label {
			flex-direction: row;
			justify-content: flex-start;
			align-items: baseline;
			font-size: 1.1rem;
			position: static;
			padding: 0;
			padding-bottom: 0.75rem;
			margin-bottom: 0.75rem;
			border-bottom: 2px solid #DE5A35;
			width: 100%;
		}

		.year-label {
			font-size: 0.8rem;
			margin-top: 0;
			margin-left: 0.5rem;
			color: #666;
		}

		.month-group {
		gap: 1rem;
		}

		.no-results {
			padding: 2rem 1rem;
		font-size: 0.9rem;
		}
	}
</style>
