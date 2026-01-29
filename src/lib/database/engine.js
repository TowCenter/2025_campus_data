const DEFAULT_S3_BASE = 'https://2025-campus-data.s3.us-east-2.amazonaws.com';

const buildDefaultUrls = (base) => ({
	fullData: `${base}/data.json`,
	metadata: `${base}/metadata.json`,
	monthManifest: `${base}/month_index/manifest.json`,
	institutionManifest: `${base}/institution_index/manifest.json`,
	monthIndex: (year) => `${base}/month_index/${year}.json`,
	institutionShard: (letter) => `${base}/institution_index/${letter}.json`,
	monthIndexNoDate: `${base}/month_index/_no_date.json`,
	article: (id) => `${base}/articles/${id}.json`,
	searchTerm: (token) => `${base}/search_term/${token}.json`
});

const resolveUrls = (custom = {}) => {
	const base = custom.base || DEFAULT_S3_BASE;
	const defaults = buildDefaultUrls(base);
	return {
		...defaults,
		...custom,
		monthIndex: custom.monthIndex || defaults.monthIndex,
		institutionShard: custom.institutionShard || defaults.institutionShard,
		article: custom.article || defaults.article,
		searchTerm: custom.searchTerm || defaults.searchTerm
	};
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getItemId = (item) => {
	if (!item) return null;
	return item.id || item._id?.$oid || item._id || item.document_id || null;
};

const getSearchTokens = (raw) => {
	return (raw || '')
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.map((t) => t.replace(/^\"+|\"+$/g, ''))
		.filter(Boolean);
};

const buildPhraseToken = (tokens) => tokens.join('_');

const getQuotedPhrase = (raw) => {
	const trimmed = (raw || '').trim();
	const match = trimmed.match(/^\"(.*)\"$/);
	if (!match) return null;
	const phrase = match[1].trim();
	return phrase || null;
};

export const createDatabaseEngine = ({
	urls: customUrls = {},
	fetcher = fetch,
	minYear = 2025
} = {}) => {
	const urls = resolveUrls(customUrls);

	let monthIndex = {};
	let institutionIndex = {};
	let institutionManifest = null;
	let institutionShards = null;
	let manifestMonthCounts = new Map();
	let months = [];
	let institutions = [];
	let globalIds = [];
	let noDateIds = [];
	let noDateLoaded = true;
	const loadedMonthFiles = new Set();

	let selectedMonths = [];
	let selectedInstitutions = [];
	let searchTerm = '';

	let activeIds = [];
	let expectedTotalCount = 0;
	let currentOffset = 0;

	let monthFiltersReady = false;
	const loadedInstitutionShards = new Set();

	let searchRunId = 0;
	let searchAbortController = null;
	const searchTokenCache = new Map();
	const articleCache = new Map();
	let fullDatasetCache = null;
	let fullDatasetMap = null;

	const fetchJson = async (url, options = {}) => {
		const { signal = null, emptyOn404 = false, returnNullOn404 = false } = options;
		const res = await fetcher(url, signal ? { signal } : undefined);
		if (res.status === 404 && (emptyOn404 || returnNullOn404)) {
			return returnNullOn404 ? null : [];
		}
		if (!res.ok) {
			throw new Error(`Failed to load ${url}: ${res.status}`);
		}
		return res.json();
	};

	const sortYearsDesc = (years) =>
		Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));

	const getMonthIndexYears = async () => {
		const manifestData = await fetchJson(urls.monthManifest);
		const years = Object.keys(manifestData || {}).filter(
			(key) => /^\d{4}$/.test(key) && Number(key) >= minYear
		);
		if (years.length === 0) {
			throw new Error('Month index manifest is empty');
		}
		return { years: sortYearsDesc(years), manifest: manifestData };
	};

	const mergeMonthData = (data) => {
		let updated = false;
		if (data && typeof data === 'object') {
			for (const [key, ids] of Object.entries(data)) {
				if (!Array.isArray(ids)) continue;
				if (monthIndex[key]) {
					monthIndex[key] = [...monthIndex[key], ...ids];
				} else {
					monthIndex[key] = ids;
				}
				updated = true;
			}
		}
		return updated;
	};

	const finalizeMonthIndex = () => {
		const manifestKeys = Array.from(manifestMonthCounts.keys());
		const allKeys = Array.from(new Set([...Object.keys(monthIndex), ...manifestKeys]));

		months = allKeys
			.filter((k) => {
				if (k === '_no_date') return false;
				const year = Number((k || '').split('-')[0]);
				return Number.isFinite(year) && year >= minYear;
			})
			.sort()
			.reverse();

		globalIds = [];
		for (const month of months) {
			const ids = monthIndex[month];
			if (Array.isArray(ids)) {
				globalIds.push(...ids);
			}
		}
		noDateIds = [];
	};

	const loadMonthIndexFile = (year) => fetchJson(urls.monthIndex(year));

	const normalizeNoDateData = (data) => {
		if (Array.isArray(data)) return { _no_date: data };
		if (data && typeof data === 'object' && Array.isArray(data._no_date)) {
			return { _no_date: data._no_date };
		}
		return null;
	};

	const loadNoDateIndex = async () => {
		try {
			const data = await fetchJson(urls.monthIndexNoDate, { emptyOn404: true });
			const normalized = normalizeNoDateData(data);
			return normalized;
		} catch {
			return null;
		}
	};

	const loadMonthManifestOptions = async () => {
		const { manifest } = await getMonthIndexYears();

		manifestMonthCounts = new Map();
		if (manifest) {
			for (const [yearKey, yearData] of Object.entries(manifest)) {
				if (!/^\d{4}$/.test(yearKey) || Number(yearKey) < minYear) continue;
				if (yearData && typeof yearData === 'object') {
					for (const [key, count] of Object.entries(yearData)) {
						const year = Number((key || '').split('-')[0]);
						if (Number.isFinite(year) && year >= minYear) {
							manifestMonthCounts.set(key, count);
						}
					}
				}
			}
		}

		const manifestKeys = Array.from(manifestMonthCounts.keys());
		months = manifestKeys
			.filter((k) => {
				if (k === '_no_date') return false;
				const year = Number((k || '').split('-')[0]);
				return Number.isFinite(year) && year >= minYear;
			})
			.sort()
			.reverse();

		monthFiltersReady = true;
	};

	const ensureMonthIndexesForSelection = async (monthsToLoad) => {
		if (!Array.isArray(monthsToLoad) || monthsToLoad.length === 0) return;
		const yearsToLoad = new Set(
			monthsToLoad
				.map((monthKey) => String(monthKey || '').split('-')[0])
				.filter((year) => /^\d{4}$/.test(year))
		);

		let updated = false;
		for (const year of yearsToLoad) {
			if (loadedMonthFiles.has(year)) continue;
			const data = await loadMonthIndexFile(year);
			loadedMonthFiles.add(year);
			updated = mergeMonthData(data) || updated;
		}

		if (updated) {
			finalizeMonthIndex();
		}
	};

	const loadInstitutionShard = (shard) => fetchJson(urls.institutionShard(shard));

	const loadInstitutionManifestOptions = async () => {
		const manifest = await fetchJson(urls.institutionManifest);
		const shards = Object.keys(manifest || {}).filter(
			(key) => manifest[key] && typeof manifest[key] === 'object'
		);
		if (shards.length === 0) {
			throw new Error('Institution manifest is empty');
		}
		institutionManifest = manifest;
		institutionShards = shards;
		institutions = shards
			.flatMap((shard) => Object.keys(manifest[shard] || {}))
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b));
	};

	const getInstitutionShards = async () => {
		if (Array.isArray(institutionShards) && institutionShards.length > 0) {
			return institutionShards;
		}
		const manifest = await fetchJson(urls.institutionManifest);
		institutionManifest = manifest;
		const shards = Object.keys(manifest || {}).filter(
			(key) => manifest[key] && typeof manifest[key] === 'object'
		);
		if (shards.length === 0) {
			throw new Error('Institution manifest is empty');
		}
		institutionShards = shards;
		return institutionShards;
	};

	const ensureInstitutionShardsForSelection = async (selected) => {
		if (!Array.isArray(selected) || selected.length === 0) return;
		if (!Array.isArray(institutionShards) || institutionShards.length === 0) {
			await getInstitutionShards();
		}
		const shardsToLoad = new Set();
		for (const inst of selected) {
			if (!inst || typeof inst !== 'string') continue;
			const shardKey = inst.trim().charAt(0).toLowerCase();
			if (shardKey && institutionShards?.includes(shardKey)) {
				shardsToLoad.add(shardKey);
			}
		}

		if (shardsToLoad.size === 0) return;

		const results = await Promise.allSettled(
			[...shardsToLoad].map((shard) =>
				loadInstitutionShard(shard).then((data) => ({ shard, data }))
			)
		);

		for (const result of results) {
			if (result.status !== 'fulfilled') continue;
			const { shard, data } = result.value;
			if (loadedInstitutionShards.has(shard)) continue;
			if (data && typeof data === 'object') {
				Object.assign(institutionIndex, data);
				loadedInstitutionShards.add(shard);
			}
		}
	};

	const getBaseIdsFromFilters = async () => {
		let baseIds = [];

		if (selectedMonths.length > 0) {
			await ensureMonthIndexesForSelection(selectedMonths);
			const monthSet = new Set(selectedMonths);
			const orderedMonths = months.filter((m) => monthSet.has(m));
			for (const month of orderedMonths) {
				const ids = monthIndex[month];
				if (Array.isArray(ids)) baseIds.push(...ids);
			}
		}

		if (selectedInstitutions.length === 0) return baseIds;

		await ensureInstitutionShardsForSelection(selectedInstitutions);
		const instIdSet = new Set();
		const instOrderedIds = [];

		for (const inst of selectedInstitutions) {
			const ids = institutionIndex[inst];
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

	const getOrderedIdsFromTokenMap = (tokens, tokenMap) => {
		const seen = new Set();
		const ordered = [];
		for (const term of tokens) {
			const ids = tokenMap.get(term);
			if (!Array.isArray(ids)) continue;
			for (const id of ids) {
				if (seen.has(id)) continue;
				seen.add(id);
				ordered.push(id);
			}
		}
		return ordered;
	};

	const startSearchRun = () => {
		searchRunId += 1;
		if (searchAbortController) {
			searchAbortController.abort();
		}
		searchAbortController = new AbortController();
		return { runId: searchRunId, signal: searchAbortController.signal };
	};

	const isActiveSearch = (runId) => runId === searchRunId;

	const ensureTokenLoaded = async (token, options = {}) => {
		if (!token) return null;
		if (searchTokenCache.has(token)) return searchTokenCache.get(token);

		try {
			const safeToken = encodeURIComponent(token);
			const ids = await fetchJson(urls.searchTerm(safeToken), {
				...options,
				emptyOn404: true,
				returnNullOn404: false
			});
			if (!Array.isArray(ids)) return [];
			searchTokenCache.set(token, ids);
			return ids;
		} catch {
			return [];
		}
	};

	const getFullDataset = async (options = {}) => {
		if (fullDatasetCache) return fullDatasetCache;
		const data = await fetchJson(urls.fullData, options);
		fullDatasetCache = data;
		return data;
	};

	const ensureFullDatasetMap = async (options = {}) => {
		if (fullDatasetMap) return fullDatasetMap;
		const data = await getFullDataset(options);
		const map = new Map();
		if (Array.isArray(data)) {
			data.forEach((item) => {
				const id = getItemId(item);
				if (id) map.set(id, item);
			});
		}
		fullDatasetMap = map;
		return fullDatasetMap;
	};

	const getArticleById = async (id, options = {}) => {
		if (articleCache.has(id)) return articleCache.get(id);
		const data = await fetchJson(urls.article(id), options);
		articleCache.set(id, data);
		return data;
	};

	const getArticleForSearch = async (id, datasetMap) => {
		if (articleCache.has(id)) return articleCache.get(id);
		if (datasetMap && datasetMap.has(id)) {
			const item = datasetMap.get(id);
			articleCache.set(id, item);
			return item;
		}
		return getArticleById(id);
	};

	const applyFiltersAndSearch = async () => {
		const { runId, signal } = startSearchRun();
		const baseIds = await getBaseIdsFromFilters();
		const hasBaseIds = baseIds.length > 0;
		const baseIdsSet = hasBaseIds ? new Set(baseIds) : null;
		const quotedPhrase = getQuotedPhrase(searchTerm);
		const phraseTokens = quotedPhrase ? getSearchTokens(quotedPhrase) : [];
		const useExactPhraseSearch = quotedPhrase && phraseTokens.length > 1;

		if (useExactPhraseSearch) {
			const phraseToken = phraseTokens.length ? buildPhraseToken(phraseTokens) : null;
			if (phraseToken) {
				const phraseIds = await ensureTokenLoaded(phraseToken, {
					signal,
					returnNullOn404: true
				});
				if (!isActiveSearch(runId)) return;
				if (Array.isArray(phraseIds) && phraseIds.length > 0) {
					const phraseSet = new Set(phraseIds);
					activeIds = hasBaseIds
						? baseIds.filter((id) => phraseSet.has(id))
						: phraseIds;
					expectedTotalCount = activeIds.length;
					currentOffset = 0;
					return;
				}
			}

			const datasetMap = await ensureFullDatasetMap({ signal });
			if (!isActiveSearch(runId)) return;
			const phraseRegex = new RegExp(`(^|\\b)${escapeRegExp(quotedPhrase)}(\\b|$)`, 'i');
			const matchedIds = [];

			const candidateIds = hasBaseIds ? baseIds : Array.from(datasetMap.keys());
			for (const id of candidateIds) {
				if (!isActiveSearch(runId)) return;
				const item = await getArticleForSearch(id, datasetMap);
				const haystacks = [item?.title, item?.org, item?.content];
				const hasMatch = haystacks.some(
					(field) => typeof field === 'string' && phraseRegex.test(field)
				);
				if (hasMatch) matchedIds.push(id);
			}

			if (!isActiveSearch(runId)) return;
			activeIds = matchedIds;
			expectedTotalCount = matchedIds.length;
			currentOffset = 0;
			return;
		}

		const tokens = getSearchTokens(searchTerm);
		if (tokens.length === 0) {
			activeIds = baseIds;
			expectedTotalCount = activeIds.length;
			currentOffset = 0;
			return;
		}

		const uniqueTokens = Array.from(new Set(tokens));
		const tokenMap = new Map();

		for (const token of uniqueTokens) {
			if (!isActiveSearch(runId)) return;
			const ids = await ensureTokenLoaded(token, { signal });
			if (Array.isArray(ids) && ids.length > 0) {
				tokenMap.set(token, ids);
			}
		}

		if (tokenMap.size === 0) {
			activeIds = [];
			expectedTotalCount = 0;
			currentOffset = 0;
			return;
		}

		const scoreMap = new Map();
		for (const term of tokens) {
			const ids = tokenMap.get(term);
			if (!Array.isArray(ids)) continue;
			for (const id of ids) {
				if (baseIdsSet && !baseIdsSet.has(id)) continue;
				const prev = scoreMap.get(id) || 0;
				scoreMap.set(id, prev + 1);
			}
		}

		if (scoreMap.size === 0) {
			activeIds = [];
			expectedTotalCount = 0;
			currentOffset = 0;
			return;
		}

		const orderingIds = hasBaseIds
			? baseIds
			: getOrderedIdsFromTokenMap(tokens, tokenMap);

		const buckets = new Map();
		for (const id of orderingIds) {
			const score = scoreMap.get(id);
			if (!score) continue;
			if (!buckets.has(score)) buckets.set(score, []);
			buckets.get(score).push(id);
		}

		const sortedScores = [...buckets.keys()].sort((a, b) => b - a);
		const filteredBySearch = [];
		for (const score of sortedScores) {
			filteredBySearch.push(...buckets.get(score));
		}

		activeIds = filteredBySearch;
		expectedTotalCount = activeIds.length;
		currentOffset = 0;
	};

	const init = async () => {
		await loadMonthManifestOptions();
		await loadInstitutionManifestOptions();
		activeIds = [];
		expectedTotalCount = 0;
		currentOffset = 0;
		return {
			months,
			institutions
		};
	};

	const setFilters = ({ months: nextMonths = null, institutions: nextInstitutions = null } = {}) => {
		if (Array.isArray(nextMonths)) selectedMonths = nextMonths;
		if (Array.isArray(nextInstitutions)) selectedInstitutions = nextInstitutions;
	};

	const setSearch = (term) => {
		searchTerm = term || '';
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
			months,
			institutions
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
		getTotalCount
	};
};
