import {
	getSearchTokens,
	getQuotedPhrase,
	buildPhraseRegex,
	buildExactTokenRegex
} from '$lib/search-highlight.js';

const buildPhraseToken = (tokens) => tokens.join('_');

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

export const createSearchManager = ({ ensureTokenLoaded, ensureFullDatasetMap, getArticleForSearch, getBaseIdsFromFilters }) => {
	let searchRunId = 0;
	let searchAbortController = null;

	const startSearchRun = () => {
		searchRunId += 1;
		if (searchAbortController) {
			searchAbortController.abort();
		}
		searchAbortController = new AbortController();
		return { runId: searchRunId, signal: searchAbortController.signal };
	};

	const isActiveSearch = (runId) => runId === searchRunId;

	const applyFiltersAndSearch = async (searchTerm, callbacks = {}) => {
		const {
			onSearchProgress = null,
			onExactMatchActive = null
		} = callbacks;
		const { runId, signal } = startSearchRun();
		const baseIds = await getBaseIdsFromFilters();
		const hasBaseIds = baseIds.length > 0;
		const baseIdsSet = hasBaseIds ? new Set(baseIds) : null;
		const quotedPhrase = getQuotedPhrase(searchTerm);
		const phraseTokens = quotedPhrase ? getSearchTokens(quotedPhrase) : [];
		const useExactPhraseSearch = quotedPhrase && phraseTokens.length > 1;
		if (onExactMatchActive) onExactMatchActive(Boolean(useExactPhraseSearch));

		if (useExactPhraseSearch) {
			const phraseToken = phraseTokens.length ? buildPhraseToken(phraseTokens) : null;
			if (phraseToken) {
				const progressHandler = onSearchProgress
					? (loaded, total) => {
							if (total > 0) onSearchProgress(Math.min(1, loaded / total));
						}
					: null;
				const phraseIds = await ensureTokenLoaded(phraseToken, {
					signal,
					returnNullOn404: true,
					returnNullOn403: true,
					onProgress: progressHandler
				});
				if (!isActiveSearch(runId)) return null;
				if (Array.isArray(phraseIds) && phraseIds.length > 0) {
					const phraseSet = new Set(phraseIds);
					const activeIds = hasBaseIds
						? baseIds.filter((id) => phraseSet.has(id))
						: phraseIds;
					return { activeIds, expectedTotalCount: activeIds.length };
				}
			}

			const progressHandler = onSearchProgress
				? (loaded, total) => {
						if (total > 0) onSearchProgress(Math.min(1, loaded / total));
					}
				: null;
			const datasetMap = await ensureFullDatasetMap({ signal, onProgress: progressHandler });
			if (!isActiveSearch(runId)) return null;
			const phraseRegex = buildPhraseRegex(quotedPhrase, 'i');
			const tokenRegex = buildExactTokenRegex(quotedPhrase, 'i');
			const chosenRegex = phraseRegex || tokenRegex;
			if (!chosenRegex) {
				return { activeIds: [], expectedTotalCount: 0 };
			}
			const matchedIds = [];

			const candidateIds = hasBaseIds ? baseIds : Array.from(datasetMap.keys());
			for (const id of candidateIds) {
				if (!isActiveSearch(runId)) return null;
				const item = await getArticleForSearch(id, datasetMap);
				const haystacks = [item?.title, item?.org, item?.content];
				const hasMatch = haystacks.some((field) => {
					if (typeof field !== 'string') return false;
					chosenRegex.lastIndex = 0;
					return chosenRegex.test(field);
				});
				if (hasMatch) matchedIds.push(id);
			}

			if (!isActiveSearch(runId)) return null;
			return { activeIds: matchedIds, expectedTotalCount: matchedIds.length };
		}

		const tokens = getSearchTokens(searchTerm);
		if (tokens.length === 0) {
			return { activeIds: baseIds, expectedTotalCount: baseIds.length };
		}

		const uniqueTokens = Array.from(new Set(tokens));
		const tokenMap = new Map();
		const totalTokens = uniqueTokens.length;
		let loadedTokens = 0;
		const updateProgress = (currentTokenProgress) => {
			if (!onSearchProgress) return;
			const normalized = Math.min(Math.max(currentTokenProgress || 0, 0), 1);
			onSearchProgress(Math.min(1, (loadedTokens + normalized) / Math.max(totalTokens, 1)));
		};

		for (const token of uniqueTokens) {
			if (!isActiveSearch(runId)) return null;
			let ids;
			let tokenProgress = 0;
			ids = await ensureTokenLoaded(token, {
				signal,
				onProgress: (loaded, total) => {
					if (!isActiveSearch(runId)) return;
					if (total > 0) {
						tokenProgress = loaded / total;
						updateProgress(tokenProgress);
					}
				}
			});
			loadedTokens += 1;
			updateProgress(0);
			if (Array.isArray(ids) && ids.length > 0) {
				tokenMap.set(token, ids);
			}
		}

		if (tokenMap.size === 0) {
			return { activeIds: [], expectedTotalCount: 0 };
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
			return { activeIds: [], expectedTotalCount: 0 };
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

		return { activeIds: filteredBySearch, expectedTotalCount: filteredBySearch.length };
	};

	return {
		applyFiltersAndSearch
	};
};
