import { parseTolerantJson } from '$lib/config/s3.js';

const getItemId = (item) => {
	if (!item) return null;
	return item.id || item._id?.$oid || item._id || item.document_id || null;
};

export const createFetcher = ({ fetcher = fetch, urls }) => {
	const searchTokenCache = new Map();
	const articleCache = new Map();
	let fullDatasetCache = null;
	let fullDatasetMap = null;

	const fetchJson = async (url, options = {}) => {
		const {
			signal = null,
			emptyOn404 = false,
			returnNullOn404 = false,
			emptyOn403 = false,
			returnNullOn403 = false
		} = options;
		const res = await fetcher(url, signal ? { signal, cache: 'no-cache' } : { cache: 'no-cache' });
		if ((res.status === 404 || res.status === 403) && (emptyOn404 || returnNullOn404 || emptyOn403 || returnNullOn403)) {
			if (res.status === 403) {
				return returnNullOn403 ? null : [];
			}
			return returnNullOn404 ? null : [];
		}
		if (!res.ok) {
			throw new Error(`Failed to load ${url}: ${res.status}`);
		}
		const text = await res.text();
		return parseTolerantJson(text);
	};

	const fetchJsonWithProgress = async (url, options = {}) => {
		const {
			signal = null,
			onProgress = null,
			emptyOn404 = false,
			returnNullOn404 = false,
			emptyOn403 = false,
			returnNullOn403 = false
		} = options;
		const res = await fetcher(url, signal ? { signal, cache: 'no-cache' } : { cache: 'no-cache' });
		if ((res.status === 404 || res.status === 403) && (emptyOn404 || returnNullOn404 || emptyOn403 || returnNullOn403)) {
			if (res.status === 403) {
				return returnNullOn403 ? null : [];
			}
			return returnNullOn404 ? null : [];
		}
		if (!res.ok) {
			throw new Error(`Failed to load ${url}: ${res.status}`);
		}

		if (!onProgress || !res.body) {
			const text = await res.text();
			return parseTolerantJson(text);
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		const totalHeader = res.headers.get('content-length');
		const total = totalHeader ? Number(totalHeader) : 0;
		let loaded = 0;
		let result = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			loaded += value?.length || 0;
			result += decoder.decode(value, { stream: true });
			if (total > 0) {
				onProgress(loaded, total);
			}
		}
		result += decoder.decode();
		if (total > 0) {
			onProgress(total || loaded, total);
		}
		return parseTolerantJson(result);
	};

	const ensureTokenLoaded = async (token, options = {}) => {
		if (!token) return null;
		if (searchTokenCache.has(token)) return searchTokenCache.get(token);

		try {
			const safeToken = encodeURIComponent(token);
			const {
				emptyOn404 = true,
				returnNullOn404 = false,
				emptyOn403 = emptyOn404,
				returnNullOn403 = returnNullOn404,
				onProgress = null,
				...rest
			} = options;
			const fetcherFn = onProgress ? fetchJsonWithProgress : fetchJson;
			const ids = await fetcherFn(urls.searchTerm(safeToken), {
				...rest,
				onProgress,
				emptyOn404,
				returnNullOn404,
				emptyOn403,
				returnNullOn403
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
		const { onProgress = null, ...rest } = options;
		const fetcherFn = onProgress ? fetchJsonWithProgress : fetchJson;
		const data = await fetcherFn(urls.fullData, { ...rest, onProgress });
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

	return {
		fetchJson,
		fetchJsonWithProgress,
		ensureTokenLoaded,
		getFullDataset,
		ensureFullDatasetMap,
		getArticleById,
		getArticleForSearch
	};
};
