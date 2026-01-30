import { URLS } from '$lib/config/s3.js';
import { createFetcher } from './engine/fetcher.js';
import { createManifestManager } from './engine/manifest.js';
import { createIndexManager } from './engine/indexes.js';
import { createSearchManager } from './engine/search.js';
import { createStatsManager } from './engine/stats.js';

export const createDatabaseEngine = ({
	urls: customUrls = {},
	fetcher = fetch,
	minYear = 2025
} = {}) => {
	const urls = {
		...URLS,
		...customUrls,
		monthIndex: customUrls.monthIndex || URLS.monthIndex,
		institutionShard: customUrls.institutionShard || URLS.institutionShard,
		article: customUrls.article || URLS.article,
		searchTerm: customUrls.searchTerm || URLS.searchTerm
	};

	const state = {
		monthIndex: {},
		institutionIndex: {},
		institutionManifest: null,
		institutionShards: null,
		manifestMonthCounts: new Map(),
		months: [],
		institutions: [],
		globalIds: [],
		noDateIds: [],
		loadedMonthFiles: new Set(),
		loadedInstitutionShards: new Set(),
		monthFiltersReady: false,
		selectedMonths: [],
		selectedInstitutions: []
	};

	let searchTerm = '';
	let activeIds = [];
	let expectedTotalCount = 0;
	let currentOffset = 0;

	const {
		fetchJson,
		ensureTokenLoaded,
		ensureFullDatasetMap,
		getArticleById,
		getArticleForSearch
	} = createFetcher({ fetcher, urls });

	const manifestManager = createManifestManager({ fetchJson, urls, minYear, state });
	const indexManager = createIndexManager({
		fetchJson,
		urls,
		minYear,
		state,
		getMonthIndexYears: manifestManager.getMonthIndexYears,
		getInstitutionShards: manifestManager.getInstitutionShards
	});

	const getBaseIdsFromFilters = async () => {
		let baseIds = [];

		if (state.selectedMonths.length > 0) {
			await indexManager.ensureMonthIndexesForSelection(state.selectedMonths);
			const monthSet = new Set(state.selectedMonths);
			const orderedMonths = state.months.filter((m) => monthSet.has(m));
			for (const month of orderedMonths) {
				const ids = state.monthIndex[month];
				if (Array.isArray(ids)) baseIds.push(...ids);
			}
		}

		if (state.selectedInstitutions.length === 0) return baseIds;

		await indexManager.ensureInstitutionShardsForSelection(state.selectedInstitutions);
		const instIdSet = new Set();
		const instOrderedIds = [];

		for (const inst of state.selectedInstitutions) {
			const ids = state.institutionIndex[inst];
			if (!Array.isArray(ids)) continue;
			for (const id of ids) {
				if (instIdSet.has(id)) continue;
				instIdSet.add(id);
				instOrderedIds.push(id);
			}
		}

		if (instOrderedIds.length === 0) return [];
		if (baseIds.length === 0) return instOrderedIds;
		return baseIds.filter((id) => instIdSet.has(id));
	};

	const searchManager = createSearchManager({
		ensureTokenLoaded,
		ensureFullDatasetMap,
		getArticleForSearch,
		getBaseIdsFromFilters
	});

	const statsManager = createStatsManager({
		state,
		ensureMonthIndexesForStats: indexManager.ensureMonthIndexesForStats,
		ensureInstitutionIndexesForStats: indexManager.ensureInstitutionIndexesForStats,
		getActiveIds: () => activeIds,
		getTotalCount: () => expectedTotalCount || activeIds.length
	});

	const init = async () => {
		await manifestManager.loadMonthManifestOptions();
		await manifestManager.loadInstitutionManifestOptions();
		activeIds = [];
		expectedTotalCount = 0;
		currentOffset = 0;
		return {
			months: state.months,
			institutions: state.institutions
		};
	};

	const setFilters = ({ months: nextMonths = null, institutions: nextInstitutions = null } = {}) => {
		if (Array.isArray(nextMonths)) state.selectedMonths = nextMonths;
		if (Array.isArray(nextInstitutions)) state.selectedInstitutions = nextInstitutions;
	};

	const setSearch = (term) => {
		searchTerm = term || '';
	};

	const applyFiltersAndSearch = async () => {
		const result = await searchManager.applyFiltersAndSearch(searchTerm);
		if (!result) return;
		activeIds = result.activeIds;
		expectedTotalCount = result.expectedTotalCount;
		currentOffset = 0;
	};

	const resetResults = () => {
		currentOffset = 0;
	};

	const loadMore = async (batchSize = 10) => {
		const ids = activeIds || [];
		const start = currentOffset;
		const end = Math.min(start + batchSize, ids.length);
		const slice = ids.slice(start, end);
		const items = await Promise.all(slice.map((id) => getArticleById(id)));
		currentOffset = end;
		return {
			items,
			hasMore: currentOffset < ids.length,
			total: expectedTotalCount || ids.length
		};
	};

	const getFilterOptions = async () => {
		return {
			months: state.months,
			institutions: state.institutions
		};
	};

	const getTotalCount = () => expectedTotalCount || activeIds.length;

	return {
		init,
		setFilters,
		setSearch,
		applyFiltersAndSearch,
		resetResults,
		loadMore,
		getFilterOptions,
		getTotalCount,
		getActiveMonthlyCounts: statsManager.getActiveMonthlyCounts,
		getActiveInstitutionCounts: statsManager.getActiveInstitutionCounts,
		getActiveStats: statsManager.getActiveStats
	};
};
