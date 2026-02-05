import { URLS } from '$lib/config/s3.js';
import { createFetcher } from './engine/fetcher.js';
import { createManifestManager } from './engine/manifest.js';
import { createIndexManager } from './engine/indexes.js';
import { createSearchManager } from './engine/search.js';
import { createStatsManager } from './engine/stats.js';

export const createDatabaseEngine = ({
	urls: customUrls = {},
	fetcher = fetch,
	minYear = 2025,
	onSearchStateChange = null,
	onExportStateChange = null
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
	const EXPORT_FULL_DATA_THRESHOLD = 1000;

	let searchState = {
		loading: false,
		progress: 0,
		exactMatchActive: false
	};
	let exportState = {
		exporting: false,
		progress: 0
	};

	const notifySearchState = () => {
		if (typeof onSearchStateChange === 'function') {
			onSearchStateChange({ ...searchState });
		}
	};

	const setSearchState = (patch) => {
		searchState = { ...searchState, ...patch };
		notifySearchState();
	};

	const notifyExportState = () => {
		if (typeof onExportStateChange === 'function') {
			onExportStateChange({ ...exportState });
		}
	};

	const setExportState = (patch) => {
		exportState = { ...exportState, ...patch };
		notifyExportState();
	};

	const {
		fetchJson,
		ensureTokenLoaded,
		ensureFullDatasetMap,
		getFullDataset,
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
		} else {
			await indexManager.ensureAllMonthIndexes();
			baseIds = state.globalIds.slice();
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
		getTotalCount: () => expectedTotalCount || activeIds.length,
		getIsUnfiltered: () =>
			state.selectedMonths.length === 0 &&
			state.selectedInstitutions.length === 0 &&
			!String(searchTerm || '').trim()
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
		const hasSearch = Boolean((searchTerm || '').trim());
		setSearchState({ loading: hasSearch, progress: 0, exactMatchActive: false });
		const result = await searchManager.applyFiltersAndSearch(searchTerm, {
			onSearchProgress: (progress) => {
				setSearchState({ progress });
			},
			onExactMatchActive: (value) => {
				setSearchState({ exactMatchActive: value });
			}
		});
		if (!result) return;
		activeIds = result.activeIds;
		expectedTotalCount = result.expectedTotalCount;
		currentOffset = 0;
		setSearchState({ loading: false });
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

	const getSearchState = () => ({ ...searchState });
	const getExportState = () => ({ ...exportState });

	const isUnfiltered = () =>
		state.selectedMonths.length === 0 &&
		state.selectedInstitutions.length === 0 &&
		!String(searchTerm || '').trim();

	const cleanDataForExport = (rows) => {
		return rows.map((item) => {
			if (!item || typeof item !== 'object') return item;
			const { llm_response, scraper, ...cleanItem } = item;
			return cleanItem;
		});
	};

	const downloadCSV = async (rows, filename = 'export.csv') => {
		if (!rows || rows.length === 0) {
			throw new Error('No data to export');
		}

		const allKeys = new Set();
		rows.forEach((item) => {
			Object.keys(item || {}).forEach((key) => allKeys.add(key));
		});
		const headers = Array.from(allKeys);

		const flattenValue = (value) => {
			if (value === null || value === undefined) return '';
			if (Array.isArray(value)) return value.join('; ');
			if (typeof value === 'object') return JSON.stringify(value);
			return String(value);
		};

		const csvRows = [];
		csvRows.push(headers.map((h) => `"${String(h).replace(/\"/g, '\"\"')}"`).join(','));
		rows.forEach((item) => {
			const row = headers.map((key) => `"${flattenValue(item?.[key]).replace(/\"/g, '\"\"')}"`);
			csvRows.push(row.join(','));
		});

		const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const slugify = (value, maxLength = 40) => {
		if (!value) return '';
		const normalized = String(value)
			.toLowerCase()
			.replace(/\"/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
		if (!normalized) return '';
		return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
	};

	const buildExportFilename = () => {
		const dateTag = new Date().toISOString().slice(0, 10);
		const parts = ['announcements-export', dateTag];

		const searchText = String(searchTerm || '').trim();
		if (searchText) {
			const cleaned = searchText.replace(/^\"(.*)\"$/, '$1');
			const searchSlug = slugify(cleaned, 50);
			if (searchSlug) parts.push(`search-${searchSlug}`);
		}

		if (Array.isArray(state.selectedMonths) && state.selectedMonths.length > 0) {
			if (state.selectedMonths.length === 1) {
				parts.push(`month-${slugify(state.selectedMonths[0], 20)}`);
			} else {
				parts.push(`months-${state.selectedMonths.length}`);
			}
		}

		if (Array.isArray(state.selectedInstitutions) && state.selectedInstitutions.length > 0) {
			if (state.selectedInstitutions.length === 1) {
				const instSlug = slugify(state.selectedInstitutions[0], 40);
				if (instSlug) parts.push(`inst-${instSlug}`);
			} else {
				parts.push(`inst-${state.selectedInstitutions.length}`);
			}
		}

		let filename = parts.filter(Boolean).join('-');
		if (filename.length > 120) {
			filename = filename.slice(0, 120);
		}
		return `${filename}.csv`;
	};

	const exportResults = async () => {
		if (!activeIds || activeIds.length === 0) {
			throw new Error('No data to export');
		}

		setExportState({ exporting: true, progress: 0 });

		try {
			const useFullDataset =
				isUnfiltered() ||
				activeIds.length > EXPORT_FULL_DATA_THRESHOLD;
			let articlesToExport;

			if (useFullDataset) {
				const progressHandler = (loaded, total) => {
					if (total > 0) {
						setExportState({ progress: Math.min(1, loaded / total) });
					}
				};
				if (isUnfiltered()) {
					articlesToExport = await getFullDataset({ onProgress: progressHandler });
				} else {
					const datasetMap = await ensureFullDatasetMap({ onProgress: progressHandler });
					articlesToExport = activeIds
						.map((id) => datasetMap.get(id))
						.filter(Boolean);
				}
			} else {
				const total = activeIds.length;
				let completed = 0;
				const track = async (id) => {
					const article = await getArticleById(id);
					completed += 1;
					setExportState({ progress: Math.min(1, completed / Math.max(total, 1)) });
					return article;
				};
				articlesToExport = await Promise.all(activeIds.map((id) => track(id)));
			}

			const cleanData = cleanDataForExport(articlesToExport);
			setExportState({ progress: 1 });
			await downloadCSV(cleanData, buildExportFilename());
		} finally {
			setExportState({ exporting: false, progress: 0 });
		}
	};

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
		getActiveStats: statsManager.getActiveStats,
		getSearchState,
		getExportState,
		exportResults
	};
};
