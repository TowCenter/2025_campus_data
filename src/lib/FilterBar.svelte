<script>
	import { onMount, onDestroy } from 'svelte';
	import SearchBar from './SearchBar.svelte';
	import MultiSelect from './MultiSelect.svelte';
	import HierarchicalFilter from './HierarchicalFilter.svelte';
	import { parseArray } from './utils.js';

	/**
	 * @typedef {Object} FilterConfigItem
	 * @property {'multi-select' | 'hierarchical' | 'date-range' | 'search'} type - Filter type
	 * @property {string} [column] - Column name (display name)
	 * @property {string} label - Display label
	 * @property {string} [dataKey] - Data key (if different from column)
	 */

	/**
	 * @typedef {Object} Props
	 * @property {any[]} [data=[]] - Data array
	 * @property {FilterConfigItem[]} [filterConfig=[]] - Filter configuration
	 * @property {Record<string, any>} [filterValues={}] - Current filter values (keyed by filter ID)
	 * @property {string} [searchQuery=''] - Search query
	 * @property {number} [filteredRowCount=0] - Number of filtered rows
	 * @property {Record<string, string>} [categoryDefinitions={}] - Category definitions
	 * @property {boolean} [isSticky=false] - Whether filter bar is sticky
	 * @property {(filterId: string, value: any) => void} [onFilterChange=() => {}] - Filter change handler
	 * @property {() => void} [onDownloadCSV=() => {}] - CSV download handler
	 */

	/** @type {Props} */
	let { 
		data = [],
		filterConfig = [],
		filterValues = {},
		searchQuery = '',
		filteredRowCount = 0,
		categoryDefinitions = {},
		isSticky = false,
		onFilterChange = () => {},
		onDownloadCSV = () => {}
	} = $props();

	/**
	 * Gets unique values for a data key
	 * @param {string} dataKey - Data field name
	 * @returns {string[]} Sorted array of unique values
	 */
	function getUniqueValues(dataKey) {
		const unique = new Set();
		
		data.forEach(row => {
			const val = row[dataKey];
			if (!val) return;
			
			// Handle arrays
			if (Array.isArray(val)) {
				val.forEach(item => {
					if (item) unique.add(String(item).trim());
				});
			} else {
				// Try parsing as comma/semicolon separated
				const parsed = parseArray(val);
				parsed.forEach(item => {
					if (item) unique.add(String(item).trim());
				});
			}
		});
		
		return Array.from(unique).filter(Boolean).sort();
	}

	/**
	 * Gets the filter ID for a filter config item
	 * @param {FilterConfigItem} filter - Filter config item
	 * @param {number} index - Filter index
	 * @returns {string}
	 */
	function getFilterId(filter, index) {
		if (filter.type === 'search') return 'search';
		if (filter.type === 'date-range') return 'filter-DateRange';
		if (filter.column) return `filter-${filter.column}`;
		return `filter-${filter.label}`;
	}

	/**
	 * Handles date range changes
	 * @param {FilterConfigItem} config - Filter config
	 * @param {string} type - 'start' or 'end'
	 * @param {string} value - Date value
	 */
	function handleDateRangeChange(config, type, value) {
		const filterId = getFilterId(config, filterConfig.indexOf(config));
		const currentValues = filterValues[filterId] || { startDate: '', endDate: '' };
		
		if (type === 'start') {
			onFilterChange(filterId, { ...currentValues, startDate: value });
		} else {
			onFilterChange(filterId, { ...currentValues, endDate: value });
		}
	}

	/**
	 * Handles filter value changes
	 * @param {FilterConfigItem} config - Filter config
	 * @param {any} value - New value
	 */
	function handleMultiSelectChange(config, value) {
		const filterId = getFilterId(config, filterConfig.indexOf(config));
		onFilterChange(filterId, value);
	}

	/**
	 * Handles search changes
	 * @param {string} query - Search query
	 */
	function handleSearchChange(query) {
		onFilterChange('search', query);
	}

	// Separate filters by type for layout
	const row1Filters = $derived(filterConfig.filter(f => f.type !== 'search'));
	const searchFilter = $derived(filterConfig.find(f => f.type === 'search'));

	// Track which date range dropdown is open
	let dateRangeOpen = $state({});
	
	// Mobile collapse state
	let isCollapsed = $state(true);
	
	let filterBarRef;

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		const dateDropdowns = document.querySelectorAll('.date-range-dropdown');
		let clickedInside = false;
		
		dateDropdowns.forEach((dropdown) => {
			if (dropdown.contains(event.target)) {
				clickedInside = true;
			}
		});
		
		if (!clickedInside) {
			dateRangeOpen = {};
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	onDestroy(() => {
		// Cleanup
	});
</script>

<div class="filter-bar" class:sticky={isSticky} bind:this={filterBarRef}>
	<button 
		class="mobile-toggle-btn"
		onclick={() => isCollapsed = !isCollapsed}
		type="button"
		aria-label={isCollapsed ? 'Expand filters' : 'Collapse filters'}
		aria-expanded={!isCollapsed}
	>
		<span class="toggle-text">{isCollapsed ? 'Show Filters' : 'Hide Filters'}</span>
		<span class="toggle-icon">{isCollapsed ? '▼' : '▲'}</span>
	</button>
	
	<div class="filter-content" class:collapsed={isCollapsed}>
		{#if row1Filters.length > 0}
			<div class="filter-row-1">
			{#each row1Filters as filter, index (getFilterId(filter, index))}
				<div class="filter-wrapper">
					<label class="filter-header">{filter.label || filter.column}</label>
					{#if filter.type === 'date-range'}
						{@const filterId = getFilterId(filter, index)}
						{@const dateRange = filterValues[filterId] || { startDate: '', endDate: '' }}
						{@const isOpen = dateRangeOpen[filterId]}
						<div class="date-range-dropdown">
							<button
								class="dropdown-header"
								class:has-selection={dateRange.startDate || dateRange.endDate}
								onclick={(e) => {
									e.stopPropagation();
									dateRangeOpen = { ...dateRangeOpen, [filterId]: !isOpen };
								}}
								type="button"
							>
								{#if dateRange.startDate || dateRange.endDate}
									<span class="header-text">
										{dateRange.startDate ? new Date(dateRange.startDate).toLocaleDateString() : 'Start'} - 
										{dateRange.endDate ? new Date(dateRange.endDate).toLocaleDateString() : 'End'}
									</span>
								{:else}
									<span class="header-text">Select Date Range</span>
								{/if}
								<span class="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
							</button>
							{#if isOpen}
								<div class="dropdown-menu date-menu">
									<div class="date-inputs">
										<label>
											Start Date
											<input 
												type="date" 
												value={dateRange.startDate}
												onchange={(e) => handleDateRangeChange(filter, 'start', e.target.value)}
												class="date-input"
											/>
										</label>
										<label>
											End Date
											<input 
												type="date" 
												value={dateRange.endDate}
												onchange={(e) => handleDateRangeChange(filter, 'end', e.target.value)}
												min={dateRange.startDate}
												class="date-input"
											/>
										</label>
									</div>
									{#if dateRange.startDate || dateRange.endDate}
										<button
											class="clear-button"
											onclick={() => {
												handleDateRangeChange(filter, 'start', '');
												handleDateRangeChange(filter, 'end', '');
											}}
											type="button"
										>
											Clear Dates
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{:else if filter.type === 'multi-select'}
						{@const filterId = getFilterId(filter, index)}
						{@const selectedValues = filterValues[filterId] || []}
						{@const options = getUniqueValues(filter.dataKey || filter.column)}
						<MultiSelect 
							label=""
							options={options}
							selectedValues={selectedValues}
							onSelectionChange={(values) => handleMultiSelectChange(filter, values)}
							categoryDefinitions={filter.column === 'Category' ? categoryDefinitions : {}}
						/>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

		<div class="filter-row-2">
			{#if searchFilter}
				<SearchBar 
					searchQuery={searchQuery}
					onSearchChange={handleSearchChange}
				/>
			{/if}

			<button 
				class="download-csv-btn" 
				onclick={onDownloadCSV}
				type="button"
				aria-label="Export {filteredRowCount} items"
			>
				Export {filteredRowCount} items
			</button>
		</div>
	</div>
</div>

<style>
	.filter-bar {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 900px;
		padding: 1.5rem;
		background-color: #fafafa;
		border: 1px solid #e0e0e0;
		width: 100%;
		position: relative;
		z-index: 9999;
		box-sizing: border-box;
		margin: 0 auto;
	}

	.filter-bar.sticky {
		border: none;
	}

	.filter-row-1 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		min-height: 44px;
		align-items: flex-start;
	}

	.filter-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		align-items: stretch;
	}

	.filter-header {
		font-weight: 400;
		font-size: 0.7rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.filter-row-2 {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.filter-row-2 > *:first-child {
		flex: 1;
		min-width: 300px;
	}

	.filter-row-2 > button {
		flex: 0 0 auto;
	}

	.download-csv-btn {
		padding: 0.6rem 1.5rem;
		background-color: #254c6f;
		color: white;
		border: 1px solid #254c6f;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.95rem;
		font-family: inherit;
		font-weight: 500;
		box-sizing: border-box;
		line-height: 1.5;
		height: 44px;
		white-space: nowrap;
		margin-top: 1.5rem;
	}

	.download-csv-btn:hover {
		background-color: #1a3a52;
	}

	/* Date Range Dropdown Styles */
	.date-range-dropdown {
		position: relative;
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.dropdown-header {
		background: white;
		border: 1px solid #ccc;
		padding: 0.6rem 0.8rem;
		font-size: 0.95rem;
		font-weight: 400;
		color: #999;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: border-color 0.2s ease;
		font-family: inherit;
		width: 100%;
		box-sizing: border-box;
		min-height: 44px;
	}

	.dropdown-header:hover {
		border-color: #999;
	}

	.dropdown-header.has-selection {
		color: #1a1a1a;
	}

	.header-text {
		flex: 1;
		text-align: left;
	}

	.dropdown-arrow {
		font-size: 0.75rem;
		margin-left: 0.5rem;
		flex-shrink: 0;
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: white;
		border: 1px solid #ccc;
		padding: 1rem;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		margin-top: 4px;
	}

	.date-menu {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.date-inputs {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.date-inputs label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.7rem;
		font-weight: 400;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.date-inputs input[type='date'] {
		padding: 0.6rem 0.8rem;
		border: 1px solid #ccc;
		font-family: inherit;
		font-size: 0.95rem;
		width: 100%;
		box-sizing: border-box;
		background-color: #fff;
	}

	.date-inputs input[type='date']:focus {
		outline: none;
		border-color: #999;
	}

	.clear-button {
		padding: 0.6rem 1.5rem;
		background-color: #254c6f;
		color: white;
		border: none;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.95rem;
		font-family: inherit;
		font-weight: 500;
		transition: all 0.2s ease;
		width: 100%;
		box-sizing: border-box;
	}

	.clear-button:hover {
		background-color: #1a3a52;
	}

	.mobile-toggle-btn {
		display: none;
	}

	.filter-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media screen and (max-width: 768px) {
		.filter-bar {
			margin: 0.15rem;
			padding: 0;
			border: 1px solid #e0e0e0;
		}

		.mobile-toggle-btn {
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;
			padding: 0.5rem 0.75rem;
			background-color: #fafafa;
			border: none;
			border-bottom: 1px solid #e0e0e0;
			cursor: pointer;
			font-family: inherit;
			font-size: 0.8rem;
			font-weight: 500;
			color: #254c6f;
			transition: background-color 0.2s ease;
		}

		.mobile-toggle-btn:hover {
			background-color: #f0f0f0;
		}

		.toggle-text {
			flex: 1;
			text-align: left;
		}

		.toggle-icon {
			font-size: 0.7rem;
			margin-left: 0.5rem;
		}

		.filter-content {
			overflow: hidden;
			transition: max-height 0.3s ease, opacity 0.3s ease;
			max-height: 2000px;
			opacity: 1;
		}

		.filter-content.collapsed {
			max-height: 0;
			opacity: 0;
			overflow: hidden;
		}

		.filter-content:not(.collapsed) {
			padding: 0.75rem;
		}

		.filter-row-1 {
			grid-template-columns: 1fr;
			gap: 0.5rem;
			min-height: unset;
		}

		.filter-wrapper {
			gap: 0.35rem;
		}

		.filter-header {
			font-size: 0.65rem;
		}

		.filter-row-2 {
			flex-direction: column;
			gap: 0.5rem;
		}

		.filter-row-2 > *:first-child {
			min-width: unset;
		}

		.download-csv-btn {
			width: 100%;
			padding: 0.5rem 1rem;
			font-size: 0.85rem;
		}

		.dropdown-header {
			padding: 0.5rem 0.65rem;
			font-size: 0.85rem;
		}

		.clear-button {
			padding: 0.5rem 1rem;
			font-size: 0.85rem;
		}
	}
</style>
