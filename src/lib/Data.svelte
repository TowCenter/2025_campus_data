<script>
	import { onMount } from 'svelte';
	import FilterBar from './FilterBar.svelte';
	import SearchCharts from './SearchCharts.svelte';
	import SearchLoading from './SearchLoading.svelte';
	import DataCard from './DataCard.svelte';
	import { getSearchTokens, getQuotedPhrase, parseSearchQuery } from './search-highlight.js';
	import { groupByMonth } from './date-utils.js';
	import './cjr.css';

	/**
	 * @typedef {Object} FilterConfigItem
	 * @property {'multi-select' | 'hierarchical' | 'date-range' | 'search'} type - Filter type
	 * @property {string} [column] - Column name (display name) - required for multi-select, optional for search/date-range
	 * @property {string} label - Display label
	 * @property {string} [dataKey] - Data key (if different from column)
	 * @property {string} [parentColumn] - Parent column for hierarchical filters
	 * @property {string} [childColumn] - Child column for hierarchical filters
	 */

	/**
	 * @typedef {Object} Props
	 * @property {any[]} [data=[]] - Data array
	 * @property {Record<string, string>} [categoryDefinitions={}] - Category definitions
	 * @property {FilterConfigItem[]} [filterConfig] - Custom filter configuration (optional, uses default if not provided)
	 * @property {Record<string, string[]>} [filterOptions={}] - Precomputed filter options keyed by dataKey
	 * @property {string} [dateField='date'] - Field name in data that contains dates
	 * @property {any} [itemComponent] - Component to render each item (optional, uses slot if not provided)
	 * @property {string} [displayMode='list'] - Display mode: 'list', 'table', 'grid', etc. (for styling purposes)
	 * @property {boolean} [showTimeline=false] - Whether to show timeline UI with date grouping
	 * @property {boolean} [showYearNavigation=false] - Whether to show year navigation sidebar
	 * @property {boolean} [hasMore=false] - Whether more items can be loaded
	 * @property {number | null} [totalCount=null] - Total results count
	 * @property {() => Promise<void>} [onLoadMore=async () => {}] - Callback to load more items
	 * @property {(args: {filterValues: Record<string, any>, searchQuery: string}) => void} [onFiltersChange=() => {}]
	 * @property {any} [chartStats=null] - Precomputed chart stats
	 * @property {any} [searchState=null] - Search loading state
	 * @property {any} [exportState=null] - Export state
	 * @property {boolean} [resultsLoading=false] - Whether initial results are loading
	 * @property {string | null} [appliedSearchQuery=null] - Last executed search query
	 * @property {() => void} [onDownloadCSV=() => {}] - CSV download handler
	 * @property {(args: {item: any, index: number, searchQuery: string, filterValues: Record<string, any>}) => any} [children] - Slot content for custom item rendering
	 */

	/** @type {Props} */
	let { 
		data = [], 
		categoryDefinitions = {},
		filterConfig = undefined,
		filterOptions = {},
		dateField = 'date',
		itemComponent = undefined,
		displayMode = 'list',
		showTimeline = false,
		showYearNavigation = false,
		hasMore = false,
		totalCount = null,
		onLoadMore = async () => {},
		onFiltersChange = () => {},
		chartStats = null,
		searchState = null,
		exportState = null,
		resultsLoading = false,
		appliedSearchQuery = null,
		onDownloadCSV = () => {},
		children = undefined
	} = $props();

	// Filter state for FilterBar
	let filterValues = $state({});
	let searchQuery = $state('');
	let isLoading = $state(false);
	
	// Track mobile screen size for responsive table/card switching
	let isMobile = $state(false);
	
	// Check if we're on mobile
	function checkMobile() {
		if (typeof window !== 'undefined') {
			isMobile = window.innerWidth <= 768;
		}
	}
	
	// Update mobile state on mount and resize
	onMount(() => {
		checkMobile();
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', checkMobile);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', checkMobile);
			}
		};
	});

	// Check if any filters or search is active
	const activeSearchQuery = $derived.by(() =>
		appliedSearchQuery !== null && appliedSearchQuery !== undefined
			? appliedSearchQuery
			: searchQuery
	);

	const hasActiveFilters = $derived.by(() => {
		const hasSearchQuery = activeSearchQuery && activeSearchQuery.trim().length > 0;
		const hasFilterValues = Object.entries(filterValues).some(([key, val]) => {
			if (key === 'search') return false;
			if (Array.isArray(val)) return val.length > 0;
			if (val && typeof val === 'object') return Object.values(val).some(v => v);
			return !!val;
		});
		return hasSearchQuery || hasFilterValues;
	});

	/** @type {HTMLElement | undefined} */
	let filterBarRef
	let isFilterBarSticky = $state(false);
	let filterBarInitialTop = 0;
	/** @type {number} */
	let filterBarHeight = $state(0);
	let filterBarWidth = $state(0);
	let filterBarLeft = $state(0);

	// Helper function to extract month from date
	function getMonthKey(dateString) {
		if (!dateString) return null;
		try {
			const dateObj = new Date(dateString);
			if (isNaN(dateObj.getTime())) return null;
			const year = dateObj.getFullYear();
			const month = dateObj.getMonth();
			return `${year}-${String(month + 1).padStart(2, '0')}`;
		} catch {
			return null;
		}
	}

	let loadSentinel = $state(null);

	// Default filter configuration - can be overridden via prop
	/** @type {FilterConfigItem[]} */
	const defaultFilterConfig = [
		{
			type: 'multi-select',
			column: 'Institution',
			label: 'Institution',
			dataKey: 'org'
		},
		{
			type: 'multi-select',
			column: 'Month',
			label: 'Month',
			dataKey: 'month',
			virtual: true
		},
		{
			type: 'multi-select',
			column: 'Category',
			label: 'Category',
			dataKey: 'category'
		},
		{
			type: 'search',
			label: 'Search'
		}
	];

	// Use provided filterConfig or default
	/** @type {FilterConfigItem[]} */
	const activeFilterConfig = $derived(filterConfig || defaultFilterConfig);

	// Add virtual 'month' field to data for filtering
	const dataWithMonth = $derived.by(() => {
		return data.map(item => ({
			...item,
			month: getMonthKey(item[dateField])
		}));
	});

	const quotedPhraseDisplay = $derived.by(() => getQuotedPhrase(activeSearchQuery));
	const exactMatchActive = $derived.by(() => Boolean(quotedPhraseDisplay));
	const searchTokens = $derived.by(() => getSearchTokens((activeSearchQuery || '').trim()));
	const parsedQuery = $derived.by(() => parseSearchQuery(activeSearchQuery || ''));

	// Format parsed query for display
	function formatQueryForDisplay(node) {
		if (!node || node.type === 'empty') return [];
		
		if (node.type === 'word') {
			return [{ type: 'word', value: node.value }];
		}
		
		if (node.type === 'phrase') {
			return [{ type: 'phrase', value: node.value }];
		}
		
		if (node.type === 'and' || node.type === 'or') {
			const parts = [];
			node.terms?.forEach((term, i) => {
				if (i > 0) {
					parts.push({ type: 'operator', value: node.type.toUpperCase() });
				}
				const termParts = formatQueryForDisplay(term);
				parts.push(...termParts);
			});
			return parts;
		}
		
		return [];
	}

	const queryDisplayParts = $derived.by(() => formatQueryForDisplay(parsedQuery));

	/**
	 * @param {string} filterId
	 * @param {any} value
	 */
	function handleFilterChange(filterId, value) {
		const nextFilterValues = { ...filterValues, [filterId]: value };
		const nextSearchQuery = filterId === 'search' ? (value || '') : searchQuery;

		// Debug logging
		console.log('Data.handleFilterChange:', {
			filterId,
			value,
			nextSearchQuery,
			nextFilterValues
		});

		filterValues = nextFilterValues;
		if (filterId === 'search') {
			searchQuery = value || '';
		}

		// Track filter/search usage in Umami
		if (typeof window !== 'undefined' && window.umami) {
			if (filterId === 'search' && value && value.trim()) {
				window.umami.track('search-query', { query: value.trim() });
			} else if (filterId !== 'search') {
				window.umami.track('filter-change', { filter: filterId });
			}
		}

		onFiltersChange({ filterValues: nextFilterValues, searchQuery: nextSearchQuery });
	}

	async function triggerLoadMore() {
		if (isLoading || !hasMore) return;
		isLoading = true;
		if (typeof window !== 'undefined' && window.umami) {
			window.umami.track('load-more-results');
		}
		try {
			await onLoadMore();
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!loadSentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					triggerLoadMore();
				}
			},
			{ rootMargin: '200px' }
		);

		observer.observe(loadSentinel);

		return () => {
			observer.disconnect();
		};
	});

	function handleScroll() {
		if (typeof window === 'undefined') return;

		const scrollY = window.scrollY || window.pageYOffset;

		// Find the footnotes/credits section to prevent overlap
		// Check multiple possible selectors for credits/footnotes
		const creditsSection = document.querySelector('.credits-toggle-section, .credits-box, #footer, footer, .footer, .meta .credits-toggle-section');
		let creditsTop = Infinity;
		
		if (creditsSection) {
			const rect = creditsSection.getBoundingClientRect();
			creditsTop = rect.top + scrollY;
		}

		// Check if filter bar should be sticky when its top reaches the top of the viewport
		if (filterBarInitialTop > 0) {
			const wasSticky = isFilterBarSticky;
			// Once sticky, keep it sticky - don't unstick unless scrolled back to very top
			const threshold = 5; // Small threshold to prevent flickering

			// Calculate if filter bar would overlap with footnotes
			const filterBarBottom = scrollY + (filterBarHeight || 0);
			const wouldOverlapFootnotes = creditsTop < Infinity && filterBarBottom >= creditsTop;

			// If already sticky, keep it sticky unless we've scrolled back above the threshold or would overlap footnotes
			if (wasSticky) {
				// Unstick if we've scrolled back above the threshold OR if we would overlap footnotes
				isFilterBarSticky = scrollY >= filterBarInitialTop - threshold && !wouldOverlapFootnotes;
				// When becoming unsticky, recapture dimensions
				if (!isFilterBarSticky && filterBarRef) {
					setTimeout(() => {
						if (filterBarRef && !isFilterBarSticky) {
							const rect = filterBarRef.getBoundingClientRect();
							filterBarWidth = rect.width;
							filterBarLeft = rect.left;
						}
					}, 50);
				}
			} else {
				// Before becoming sticky, capture current dimensions
				if (scrollY >= filterBarInitialTop && filterBarRef) {
					const rect = filterBarRef.getBoundingClientRect();
					if (filterBarWidth === 0) filterBarWidth = rect.width;
					if (filterBarLeft === 0) filterBarLeft = rect.left;
				}
				// If not sticky yet, make it sticky when we reach the initial position (but not if it would overlap footnotes)
				isFilterBarSticky = scrollY >= filterBarInitialTop && !wouldOverlapFootnotes;
			}

			// Update filter bar height when it becomes sticky - measure immediately
			if (isFilterBarSticky && (!wasSticky || filterBarHeight === 0) && filterBarRef) {
				const rect = filterBarRef.getBoundingClientRect();
				filterBarHeight = rect.height;
			}
		} else if (filterBarRef) {
			// Initialize on first scroll if not already set
			// Only initialize if filter bar is not sticky (otherwise getBoundingClientRect won't work correctly)
			if (!isFilterBarSticky) {
				const rect = filterBarRef.getBoundingClientRect();
				filterBarInitialTop = rect.top + scrollY;
				filterBarWidth = rect.width;
				filterBarLeft = rect.left;
				
				// Check if we would overlap footnotes before making sticky
				const filterBarBottom = scrollY + rect.height;
				const wouldOverlapFootnotes = creditsTop < Infinity && filterBarBottom >= creditsTop;
				isFilterBarSticky = scrollY >= filterBarInitialTop && !wouldOverlapFootnotes;
				
				if (isFilterBarSticky) {
					filterBarHeight = rect.height;
				}
			}
		}
	}
	const displayData = $derived.by(() => dataWithMonth);

	const resultCount = $derived.by(() =>
		typeof totalCount === 'number' ? totalCount : displayData.length
	);

	const searchLoading = $derived.by(() => Boolean(searchState?.loading));
	const searchProgress = $derived.by(() => Number(searchState?.progress || 0));
	const searchExactMatch = $derived.by(() => Boolean(searchState?.exactMatchActive));
	const exportLoading = $derived.by(() => Boolean(exportState?.exporting));
	const exportProgress = $derived.by(() => Number(exportState?.progress || 0));
	const combinedLoading = $derived.by(() => Boolean(searchLoading || resultsLoading));
	const loadingProgress = $derived.by(() => (searchLoading ? searchProgress : 1));

	// Group data by month if timeline is enabled
	const groupedData = $derived.by(() => {
		if (!showTimeline) return {};
		return groupByMonth(displayData, dateField);
	});
	
	// Get visible items - sorted by date descending or grouped by timeline
	// When searching, preserve backend order (relevance-ranked by number of matching terms)
	const visibleItems = $derived.by(() => {
		if (showTimeline) {
			// For timeline, return grouped data structure
			const grouped = groupedData;
			const allItems = [];

			for (const [dateKey, items] of Object.entries(grouped)) {
				for (const item of items) {
					allItems.push({ ...item, dateKey });
				}
			}
			return allItems;
		} else {
			// When searching, preserve backend order (relevance-ranked)
			// Results from search engine are already sorted by match count (highest first)
			if (activeSearchQuery && activeSearchQuery.trim()) {
				return displayData;
			}

			// Sort by date descending when not searching
			const sorted = [...displayData].sort((a, b) => {
				const dateA = a[dateField] ? new Date(a[dateField]) : new Date(0);
				const dateB = b[dateField] ? new Date(b[dateField]) : new Date(0);
				return dateB.getTime() - dateA.getTime();
			});
			return sorted;
		}
	});

	// Compute padding top for sticky filter bar
	/** @type {string} */
	const paddingTop = $derived.by(() => {
		if (isFilterBarSticky && filterBarHeight > 0) {
			return `${Number(filterBarHeight) + 40}px`;
		}
		return '';
	});

	onMount(() => {
		// Initialize filter bar position and dimensions
		if (filterBarRef && typeof window !== 'undefined') {
			const rect = filterBarRef.getBoundingClientRect();
			const scrollY = window.scrollY || window.pageYOffset;
			filterBarInitialTop = rect.top + scrollY;
			// Store initial dimensions
			filterBarHeight = rect.height;
			filterBarWidth = rect.width;
			filterBarLeft = rect.left;
		}

		// Add scroll listener
		if (typeof window !== 'undefined') {
			window.addEventListener('scroll', handleScroll, { passive: true });
			// Check initial scroll position immediately
			handleScroll();
		}
		
		// Also check after a brief delay to catch any layout shifts
		const initialCheck = () => {
			if (filterBarRef && typeof window !== 'undefined') {
				// Only recalculate if not sticky and initialTop is 0 or incorrect
				if (!isFilterBarSticky) {
					const rect = filterBarRef.getBoundingClientRect();
					const scrollY = window.scrollY || window.pageYOffset;
					if (filterBarInitialTop === 0 || Math.abs(filterBarInitialTop - (rect.top + scrollY)) > 10) {
						filterBarInitialTop = rect.top + scrollY;
						filterBarWidth = rect.width;
						filterBarLeft = rect.left;
						isFilterBarSticky = scrollY >= filterBarInitialTop;
						if (isFilterBarSticky) {
							filterBarHeight = rect.height;
						}
					}
				}
				handleScroll();
			}
		};
		
		// Use requestAnimationFrame for immediate check after layout
		requestAnimationFrame(() => {
			requestAnimationFrame(initialCheck);
		});
		
		// Recalculate on resize
		const handleResize = () => {
			if (filterBarRef && typeof window !== 'undefined') {
				// Only recalculate position/dimensions if not sticky (when sticky, getBoundingClientRect gives wrong position)
				if (!isFilterBarSticky) {
					const rect = filterBarRef.getBoundingClientRect();
					const scrollY = window.scrollY || window.pageYOffset;
					if (filterBarInitialTop === 0) {
						filterBarInitialTop = rect.top + scrollY;
					}
					// Always update width and left on resize when not sticky
					filterBarWidth = rect.width;
					filterBarLeft = rect.left;
				}
				// Always update height if sticky
				if (isFilterBarSticky) {
					const rect = filterBarRef.getBoundingClientRect();
					filterBarHeight = rect.height;
				}
				// Re-check sticky state
				handleScroll();
			}
		};
		
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', handleResize, { passive: true });
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('scroll', handleScroll);
				window.removeEventListener('resize', handleResize);
			}
		};
	});
</script>

<div class="data-wrapper">
	<div
		class="filter-bar-wrapper"
		class:sticky={isFilterBarSticky}
		bind:this={filterBarRef}
		style={isFilterBarSticky && filterBarWidth > 0 ? `width: ${filterBarWidth}px; left: ${filterBarLeft}px;` : ''}
	>
		<FilterBar
			data={dataWithMonth}
			filterConfig={activeFilterConfig}
			{filterOptions}
			{filterValues}
			{searchQuery}
			filteredRowCount={resultCount}
			{categoryDefinitions}
			onFilterChange={handleFilterChange}
			onDownloadCSV={onDownloadCSV}
			exporting={exportLoading}
			exportProgress={exportProgress}
			isSticky={isFilterBarSticky}
		/>
	</div>

	{#if isFilterBarSticky}
		<div class="sticky-spacer" style="height: {filterBarHeight}px;"></div>
	{/if}

	{#if !combinedLoading}
		<div class="search-charts-wrapper">
			<SearchCharts
				data={displayData}
				{dateField}
				orgField="org"
				searchQuery={activeSearchQuery}
				stats={chartStats}
				allMonths={filterOptions.month || []}
			/>
		</div>
	{/if}

	{#if hasActiveFilters}
		{#if !combinedLoading && activeSearchQuery && activeSearchQuery.trim()}
			<div class="search-query-cue">
				<span class="cue-label">Matching</span>
				{#each queryDisplayParts as part, i}
					{#if part.type === 'operator'}
						<span class="cue-operator">{part.value}</span>
					{:else if part.type === 'phrase'}
						<span class="cue-term">"{part.value}"</span>
					{:else if part.type === 'word'}
						<span class="cue-term">"{part.value}"</span>
					{/if}
				{/each}
				<span class="cue-count">— {resultCount} result{resultCount !== 1 ? 's' : ''}</span>
			</div>
		{/if}
		{#if combinedLoading}
			<SearchLoading
				loading={combinedLoading}
				progress={loadingProgress}
				showProgress={Boolean(activeSearchQuery && activeSearchQuery.trim())}
				note={searchExactMatch ? 'Exact phrase searches take longer. Thanks for your patience.' : ''}
			/>
		{:else if hasActiveFilters && resultCount === 0}
			<div class="no-data-message">
				<p>No results found.</p>
			</div>
		{:else}
<div class="data-container data-{displayMode}" class:timeline={showTimeline}>
	{#if showTimeline}
		<!-- Timeline view with date grouping -->
		{@const allGroupedEntries = Object.entries(groupedData)}
		{#each allGroupedEntries as [dateKey, items]}
			{@const firstItem = items[0]}
			{@const displayDate = firstItem?.date ? new Date(firstItem.date) : null}
			{@const displayDateKey = displayDate && !isNaN(displayDate.getTime()) ? displayDate.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' }) : dateKey}
			<div class="timeline-row">
				<div class="timeline-date">
					<div class="date-tag">
						<span class="date-month-day">{displayDateKey.split(',').slice(0, 1).join(',').trim()}</span>
						<span class="date-year">{displayDateKey.split(',').slice(1).join(',').trim()}</span>
					</div>
				</div>
				<div class="timeline-divider"></div>
				<div class="timeline-content">
					{#if itemComponent}
						{#each items as item, index}
							{@const Component = itemComponent}
							{@const itemDate = item.date ? new Date(item.date) : null}
							{@const itemDateKey = itemDate && !isNaN(itemDate.getTime()) ? itemDate.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
							<Component 
								{item}
								dateKey={itemDateKey}
								{index}
								{searchQuery}
								{filterValues}
							/>
						{/each}
					{:else if children}
						{#each items as item, index}
							{@render children({ item, index, searchQuery, filterValues })}
					{/each}
					{/if}
				</div>
			</div>
		{/each}
	{:else}
		<!-- Simple list or table view -->
		{#if displayMode === 'table'}
			{#if isMobile}
				<!-- Card view on mobile -->
				<div class="data-cards-mobile">
					{#each visibleItems as item, index}
						<DataCard 
							{item}
							{index}
							searchQuery={activeSearchQuery}
							{filterValues}
						/>
					{/each}
				</div>
			{:else}
				<!-- Table view on desktop -->
				<table class="data-table">
					<thead>
						<tr>
							<th class="table-header">Date</th>
							<th class="table-header">School</th>
							<th class="table-header">Content</th>
						</tr>
					</thead>
					<tbody>
						{#if itemComponent}
							{#each visibleItems as item, index}
								{@const Component = itemComponent}
								<Component 
									{item}
									{index}
									searchQuery={activeSearchQuery}
									{filterValues}
									dateField={dateField}
								/>
							{/each}
						{:else if children}
							{#each visibleItems as item, index}
								{@render children({ item, index, searchQuery: activeSearchQuery, filterValues })}
							{/each}
						{/if}
					</tbody>
				</table>
			{/if}
		{:else}
			<!-- List view -->
			{#if itemComponent}
				<!-- Use provided component to render items -->
				{#each visibleItems as item, index}
					{@const Component = itemComponent}
					<Component 
						{item}
						{index}
						searchQuery={activeSearchQuery}
						{filterValues}
					/>
				{/each}
			{:else if children}
				<!-- Use slot for custom rendering -->
				{#each visibleItems as item, index}
					{@render children({ item, index, searchQuery: activeSearchQuery, filterValues })}
				{/each}
			{/if}
		{/if}
	{/if}
	{#if isLoading}<p class="loading">Loading more...</p>{/if}
	{#if hasMore}
		<div class="infinite-sentinel" bind:this={loadSentinel} aria-hidden="true"></div>
	{/if}
</div>
		{/if}
	{:else}
		<div class="no-data-message">
			<p>Use the filters to search announcements</p>
		</div>
	{/if}
</div>
<style>
	/* Data Wrapper */
	.data-wrapper {
		width: 100%;
	}

	.no-data-message {
		text-align: center;
		padding: 2rem;
		color: #666;
		font-size: 1rem;
	}

	.search-query-cue {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		padding: 0.75rem 0;
		font-size: 0.9rem;
		color: #444;
		border-bottom: 1px solid #e0e0e0;
		margin-bottom: 0.5rem;
	}

	.cue-label {
		color: #666;
		font-weight: 400;
	}

	.cue-operator {
		color: #254c6f;
		font-weight: 600;
		font-size: 0.8rem;
		text-transform: uppercase;
	}

	.cue-term {
		color: #254c6f;
		font-weight: 500;
	}

	.cue-count {
		color: #888;
		font-size: 0.85rem;
		margin-left: 0.25rem;
	}

	/* Filter Bar Wrapper */
	.filter-bar-wrapper {
		position: relative;
		z-index: 9999;
		width: 100%;
		margin: 0 0 1.5rem 0;
		padding: 0;
	}

	.search-charts-wrapper {
		width: 100%;
		padding: 0;
		margin: 0 0 2rem 0;
	}

	.sticky-spacer {
		width: 100%;
		flex-shrink: 0;
	}

	.filter-bar-wrapper.sticky {
		position: fixed;
		top: 0;
		margin: 0;
		padding: 0;
		background-color: #fafafa;
		border-bottom: 1px solid #e0e0e0;
		z-index: 9999;
	}

	@media screen and (max-width: 767px) {
		.filter-bar-wrapper {
			margin: 0 1rem 1.5rem 1rem;
			padding: 0;
			width: calc(100% - 2rem);
			max-width: calc(100% - 2rem);
			box-sizing: border-box;
			overflow: visible;
		}

		.data-wrapper {
			width: 100%;
			overflow-x: visible;
		}
		.search-charts-wrapper {
			margin: 0 1rem 1.5rem 1rem;
			width: calc(100% - 2rem);
			max-width: calc(100% - 2rem);
			box-sizing: border-box;
		}
		.search-query-cue {
			margin: 0 1rem 0.5rem 1rem;
		}
		.no-data-message {
			margin: 0 1rem;
		}
		.data-cards-mobile {
			padding: 0 1rem;
			margin: 0;
		}
		.recent-announcements-title {
			padding: 0 1rem;
			margin: 2rem 1rem 1.5rem 1rem;
		}
		.data-container {
			margin: 0 1rem;
		}
	}
	@media screen and (min-width: 768px) and (max-width: 1024px) {
		.filter-bar-wrapper {
			margin: 0 1.5rem 1.5rem 1.5rem;
			width: calc(100% - 3rem);
			max-width: calc(100% - 3rem);
		}
		.search-charts-wrapper {
			margin: 0 1.5rem 2rem 1.5rem;
			width: calc(100% - 3rem);
			max-width: calc(100% - 3rem);
			box-sizing: border-box;
		}
		.data-cards-mobile {
			padding: 0 1.5rem;
		}
	}

	/* Data Container */
	.data-container {
		width: 100%;
		padding: 0 0 4rem;
		margin: 0;
		box-sizing: border-box;
	}

	.data-container.data-list {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		margin-top: 2rem;
	}

	.data-container.data-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 2rem;
		margin-top: 2rem;
	}

	.data-table {
		width: 100%;
		max-width: 100%;
		border-collapse: collapse;
		background-color: white;
		margin: 0;
		table-layout: auto;
		box-sizing: border-box;
	}

	.table-header {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.7rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border-bottom: 2px solid #e0e0e0;
		background-color: #fafafa;
	}

	@media (max-width: 767px) {
		.data-table {
			display: block;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.table-header {
			padding: 0.75rem 0.5rem;
		}
	}

	.data-container.data-table {
		margin: 2rem 0 0 0;
		width: 100%;
		box-sizing: border-box;
		padding: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: stretch;
	}

	.data-container.data-table .data-table {
		width: auto;
		max-width: 100%;
		table-layout: auto;
		margin: 0 auto;
		display: table;
		align-self: center;
	}

	.data-cards-mobile {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		margin: 0;
		padding: 0;
	}


	/* Timeline view styles */
	.data-container.timeline {
		max-width: 1000px;
		padding: 0 3rem 2rem;
	}

	.timeline-row {
		display: grid;
		grid-template-columns: 100px 2px 1fr;
		gap: 0.75rem;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		overflow: visible;
	}

	.timeline-divider {
		background: #e0e0e0;
		width: 1.5px;
		height: 100%;
		opacity: 1;
	}

	.timeline-date {
		position: sticky;
		top: calc(200px + 1rem);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-right: 0.75rem;
		margin-right: 0;
		z-index: 900;
		padding-top: 0.5rem;
		line-height: 1.2;
	}

	.date-tag {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-family: inherit;
		width: 100%;
		min-width: 80px;
	}

	.date-month-day {
		font-size: 0.875rem;
		font-weight: 500;
		color: #1a1a1a;
		text-transform: capitalize;
		line-height: 1.3;
		text-align: right;
		white-space: nowrap;
	}

	.date-year {
		font-size: 0.75rem;
		color: #666;
		margin-top: 0.15rem;
		font-weight: 400;
		text-align: right;
		white-space: nowrap;
	}

	.timeline-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		overflow: visible;
		min-width: 0;
		width: 100%;
	}


	.loading {
		text-align: center;
		padding: 1rem;
		color: #6b7280;
		font-size: 0.875rem;
	}

	.infinite-sentinel {
		width: 100%;
		height: 1px;
	}

	/* Responsive styles consolidated in main mobile breakpoint above */
	@media screen and (max-width: 767px) {
		.data-container.data-grid {
			grid-template-columns: 1fr;
		}

		.data-container.timeline {
			padding: 0 1rem 2rem;
		}

		.timeline-row {
			display: flex;
			flex-direction: column;
			margin-bottom: 1rem;
			gap: 0;
		}

		.timeline-date {
			flex-direction: row;
			justify-content: flex-start;
			align-items: baseline;
			font-size: 1.25rem;
			position: static;
			padding: 0;
			padding-bottom: 1rem;
			margin-bottom: 1rem;
			margin-right: 0;
			border-bottom: 2px solid #254c6f;
		}

		.date-tag {
			flex-direction: row;
			align-items: baseline;
		}

		.date-month-day {
			font-size: 0.875rem;
		}

		.date-year {
			font-size: 0.75rem;
			margin-top: 0;
			margin-left: 0.25rem;
			color: #666;
		}

		.timeline-content {
			gap: 0.25rem;
		}

		.data-cards-mobile {
			margin: 0;
			padding: 0 1rem;
		}

		.search-charts-wrapper {
			margin: 0 1rem 1.5rem 1rem;
			width: calc(100% - 2rem);
			max-width: calc(100% - 2rem);
		}
		.search-query-cue {
			margin: 0 1rem 0.5rem 1rem;
		}
		.no-data-message {
			margin: 0 1rem;
		}
		.recent-announcements-title {
			margin: 2rem 1rem 1.5rem 1rem;
		}
	}
</style>
