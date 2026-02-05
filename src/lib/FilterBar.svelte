<script>
	import { onMount, onDestroy } from 'svelte';
	import SearchBar from './SearchBar.svelte';
	import ExportProgress from './ExportProgress.svelte';
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
	 * @property {Record<string, string[]>} [filterOptions={}] - Precomputed filter options keyed by dataKey
	 * @property {boolean} [isSticky=false] - Whether filter bar is sticky
	 * @property {(filterId: string, value: any) => void} [onFilterChange=() => {}] - Filter change handler
	 * @property {() => void} [onDownloadCSV=() => {}] - CSV download handler
	 * @property {boolean} [exporting=false] - Whether export is running
	 * @property {number} [exportProgress=0] - Export progress ratio (0-1)
	 * @property {() => void} [onSeeAllData=() => {}] - See all data handler
	 */

	/** @type {Props} */
	let { 
		data = [],
		filterConfig = [],
		filterValues = {},
		searchQuery = '',
		filteredRowCount = 0,
		categoryDefinitions = {},
		filterOptions = {},
		isSticky = false,
		onFilterChange = () => {},
		onDownloadCSV = () => {},
		exporting = false,
		exportProgress = 0,
		onSeeAllData = () => {}
	} = $props();

	/**
	 * Gets unique values for a data key
	 * @param {string} dataKey - Data field name
	 * @returns {string[]} Sorted array of unique values
	 */
	function getUniqueValues(dataKey) {
		const providedOptions = filterOptions?.[dataKey];
		if (Array.isArray(providedOptions)) {
			return providedOptions;
		}

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

		const values = Array.from(unique).filter(Boolean).sort();

		// Format month values for better display
		if (dataKey === 'month') {
			return values.reverse(); // Show newest months first
		}

		return values;
	}

	/**
	 * Formats display text for filter options
	 * @param {string} value - Value to format
	 * @param {string} dataKey - Data key context
	 * @returns {string} Formatted display text
	 */
	function formatOptionDisplay(value, dataKey) {
		if (dataKey === 'month') {
			const [year, month] = value.split('-');
			const date = new Date(parseInt(year), parseInt(month) - 1);
			return date.toLocaleString('default', { month: 'long', year: 'numeric' });
		}
		return value;
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

	function handleSeeAllData() {
		onSeeAllData();
	}

	// Separate filters by type for layout
	const row1Filters = $derived(filterConfig.filter(f => f.type !== 'search'));
	const searchFilter = $derived(filterConfig.find(f => f.type === 'search'));

	// Track which date range dropdown is open
	let dateRangeOpen = $state({});
	
	// Mobile collapse state
	// Default to open on mobile, closed on desktop
	let isCollapsed = $state(false);
	
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
		
		// Default to open on mobile (filters start open)
		if (typeof window !== 'undefined' && window.innerWidth <= 767) {
			isCollapsed = false;
		}
		
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
		data-umami-event="mobile-filter-toggle"
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
						{@const rawOptions = getUniqueValues(filter.dataKey || filter.column)}
						{@const dataKey = filter.dataKey || filter.column}
						{@const displayOptions = dataKey === 'month' ? rawOptions.map(v => formatOptionDisplay(v, dataKey)) : rawOptions}
						{@const rawToDisplay = dataKey === 'month' ? Object.fromEntries(rawOptions.map((v, i) => [v, displayOptions[i]])) : {}}
						{@const displayToRaw = dataKey === 'month' ? Object.fromEntries(displayOptions.map((v, i) => [v, rawOptions[i]])) : {}}
						{@const selectedDisplayValues = dataKey === 'month' ? selectedValues.map(v => rawToDisplay[v] ?? v) : selectedValues}
						<MultiSelect
							label=""
							options={displayOptions}
							selectedValues={selectedDisplayValues}
							onSelectionChange={(values) => {
								const normalized = dataKey === 'month'
									? values.map(v => displayToRaw[v] ?? v)
									: values;
								handleMultiSelectChange(filter, normalized);
							}}
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
				class="search-btn"
				type="button"
				aria-label="See all data for {filteredRowCount} items"
				data-umami-event="search-button-click"
				onclick={handleSeeAllData}
			>
				See all data
			</button>

			<button
				class="export-btn"
				onclick={onDownloadCSV}
				type="button"
				aria-label="Export {filteredRowCount} items"
				disabled={exporting}
				data-umami-event="export-csv-click"
			>
				{#if exporting}
					<ExportProgress exporting={exporting} progress={exportProgress} />
				{:else}
					Export
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.filter-bar {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		padding: 1.5rem;
		background-color: #fafafa;
		border: 1px solid #e0e0e0;
		position: relative;
		z-index: 9999;
		box-sizing: border-box;
		margin: 0;
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

	.search-btn {
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

	.search-btn:hover {
		background-color: #1a3a52;
	}

	.export-btn {
		padding: 0.6rem 1.5rem;
		background-color: white;
		color: #254c6f;
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

	.export-btn:hover {
		background-color: #f5f5f5;
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

	@media screen and (max-width: 767px) {
		.filter-bar {
			margin: 0;
			padding: 1rem;
			border: 1px solid #e0e0e0;
			width: 100%;
			max-width: 100%;
			box-sizing: border-box;
		}

		.mobile-toggle-btn {
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;
			padding: 0.75rem 1rem;
			min-height: 44px;
			background-color: #fafafa;
			border: none;
			border-bottom: 1px solid #e0e0e0;
			cursor: pointer;
			font-family: inherit;
			font-size: 0.875rem;
			font-weight: 500;
			color: #254c6f;
			transition: background-color 0.2s ease;
			touch-action: manipulation;
		}

		.mobile-toggle-btn:hover,
		.mobile-toggle-btn:active {
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
			padding: 1rem;
		}

		.filter-row-1 {
			grid-template-columns: 1fr;
			gap: 0.75rem;
			min-height: unset;
		}

		.filter-wrapper {
			gap: 0.5rem;
		}

		.filter-header {
			font-size: 0.7rem;
		}

		.filter-row-2 {
			flex-direction: column;
			gap: 0.75rem;
		}

		.filter-row-2 > *:first-child {
			min-width: unset;
		}

		.search-btn,
		.export-btn {
			width: 100%;
			padding: 0.75rem 1rem;
			min-height: 44px;
			font-size: 0.9rem;
			margin-top: 0;
			touch-action: manipulation;
		}

		.dropdown-header {
			padding: 0.75rem 0.85rem;
			min-height: 44px;
			font-size: 0.9rem;
			touch-action: manipulation;
		}

		.clear-button {
			padding: 0.75rem 1rem;
			min-height: 44px;
			font-size: 0.9rem;
			touch-action: manipulation;
		}
	}
</style>
