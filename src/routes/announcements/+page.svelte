<script>
	import { onMount } from 'svelte';
	import Header from '../../lib/Header.svelte';
	import Article from '../../lib/Article.svelte';
	import Headline from '../../lib/Headline.svelte';
	import Body from '../../lib/Body.svelte';
	import Data from '../../lib/Data.svelte';
	import DataTableRow from '../../lib/DataTableRow.svelte';
	import Footer from '../../lib/Footer.svelte';
	import { getLatestDate } from '../../lib/data-utils.js';
	import { createDatabaseEngine } from '$lib/database/engine.js';
	import { config } from '../../config.js';
	import '../../lib/cjr.css';

	export let data;

	// Get last updated date from metadata
	const lastUpdatedDate = getLatestDate(data?.metadata, config.lastUpdatedField);

	// Ensure categoryDefinitions is the right type
	/** @type {Record<string, string>} */
	const categoryDefinitions = config.categoryDefinitions || {};

	const batchSize = 10;
	let engine;
	let items = [];
	let hasMore = false;
	let totalCount = 0;
	let filterOptions = {};
	let chartStats = null;
	let refreshId = 0;
	let loadingMore = false;
	let normalizedCache = new Map();
	let debounceTimer = null;

	const normalizeDate = (value) => {
		const dateStr = value?.$date || value;
		if (!dateStr || typeof dateStr !== 'string') return null;
		const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
		return match ? match[1] : dateStr;
	};

	const normalizeArticle = (item) => {
		if (!item) return item;
		const id = item.id || item._id?.$oid || item._id || item.document_id || null;
		if (id && normalizedCache.has(id)) return normalizedCache.get(id);

		const orgArray = Array.isArray(item.org)
			? item.org
			: (typeof item.org === 'string'
				? item.org.split(',').map((o) => o.trim()).filter(Boolean)
				: []);

		const normalized = {
			...item,
			_id: id ?? item._id,
			date: normalizeDate(item.date),
			last_updated: normalizeDate(item.last_updated_at || item.last_updated),
			org: orgArray,
			description: item.description || item.content || ''
		};

		if (id) normalizedCache.set(id, normalized);
		return normalized;
	};

	const getFilterId = (dataKey, fallbackLabel) => {
		const cfg = (config.filterConfig || []).find((f) => f.dataKey === dataKey);
		const label = cfg?.column || cfg?.label || fallbackLabel;
		return label ? `filter-${label}` : null;
	};

	const monthFilterId = getFilterId('month', 'Month');
	const orgFilterId = getFilterId('org', 'School');

	async function initEngine() {
		try {
			engine = createDatabaseEngine();
			await engine.init();
			const options = await engine.getFilterOptions();
			filterOptions = {
				month: options.months || [],
				org: options.institutions || []
			};
		} catch (error) {
			console.error('Failed to initialize database engine', error);
		}
	}

	async function refreshResults() {
		const currentRefresh = ++refreshId;
		items = [];
		hasMore = false;
		totalCount = 0;
		chartStats = null;

		await engine.applyFiltersAndSearch();
		if (currentRefresh !== refreshId) return;

		const [result, stats] = await Promise.all([
			engine.loadMore(batchSize),
			engine.getActiveStats()
		]);
		if (currentRefresh !== refreshId) return;

		items = result.items.map(normalizeArticle);
		hasMore = result.hasMore;
		totalCount = result.total;
		chartStats = stats;
	}

	async function handleLoadMore() {
		if (!engine || loadingMore || !hasMore) return;
		loadingMore = true;
		const currentRefresh = refreshId;
		try {
			const result = await engine.loadMore(batchSize);
			if (currentRefresh !== refreshId) return;
			items = [...items, ...result.items.map(normalizeArticle)];
			hasMore = result.hasMore;
			totalCount = result.total;
		} finally {
			loadingMore = false;
		}
	}

	function handleFiltersChange({ filterValues, searchQuery }) {
		if (!engine) return;
		const months = monthFilterId ? (filterValues[monthFilterId] || []) : [];
		const institutions = orgFilterId ? (filterValues[orgFilterId] || []) : [];
		engine.setFilters({ months, institutions });
		engine.setSearch(searchQuery);

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			refreshResults();
		}, 500);
	}

	onMount(async () => {
		await initEngine();
		await refreshResults();
	});

	onMount(() => {
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

<Header />
<Article>
	<Headline
		hed={config.headline}
		subhed="Browse all announcements with filters. Use the filters to narrow down by school, date range, or search terms."
		brand={config.brand}
		date={lastUpdatedDate}
		dateLabel={config.dateLabel}
		byline={config.byline}
		byline_url={config.bylineUrl}
		maintainedBy={config.maintainedBy}
		designDevelopment={config.designDevelopment}
		acknowledgements={config.acknowledgements}
	>
	</Headline>

	<Body navItems={config.navItems} showLeftNav={false}>
		<Data
			data={items}
			filterConfig={config.filterConfig}
			{filterOptions}
			chartStats={chartStats}
			dateField={config.dateField}
			{totalCount}
			{hasMore}
			onLoadMore={handleLoadMore}
			onFiltersChange={handleFiltersChange}
			showTimeline={false}
			showYearNavigation={false}
			{categoryDefinitions}
			itemComponent={DataTableRow}
			displayMode="table"
		/>
	</Body>
</Article>
<Footer />
