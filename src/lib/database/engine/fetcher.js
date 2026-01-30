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
		const { signal = null, emptyOn404 = false, returnNullOn404 = false } = options;
		const res = await fetcher(url, signal ? { signal, cache: 'no-cache' } : { cache: 'no-cache' });
		if (res.status === 404 && (emptyOn404 || returnNullOn404)) {
			return returnNullOn404 ? null : [];
		}
		if (!res.ok) {
			throw new Error(`Failed to load ${url}: ${res.status}`);
		}
		const text = await res.text();
		return parseTolerantJson(text);
	};

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

	return {
		fetchJson,
		ensureTokenLoaded,
		getFullDataset,
		ensureFullDatasetMap,
		getArticleById,
		getArticleForSearch
	};
};
