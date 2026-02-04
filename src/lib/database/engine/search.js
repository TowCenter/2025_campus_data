import {
	getSearchTokens,
	getQuotedPhrase,
	buildPhraseRegex,
	buildExactTokenRegex,
	parseSearchQuery
} from '$lib/search-highlight.js';

const buildPhraseToken = (tokens) => tokens.join('_');

/**
 * Get IDs matching a single phrase using phrase index or regex fallback
 */
const getPhraseMatchIds = async (phrase, baseIds, baseIdsSet, ensureTokenLoaded, ensureFullDatasetMap, getArticleForSearch, signal, isActiveSearch, runId, onProgress) => {
	const phraseTokens = getSearchTokens(phrase);
	if (phraseTokens.length === 0) return [];

	// Try phrase index first (e.g., "funding_cut")
	if (phraseTokens.length > 1) {
		const phraseToken = buildPhraseToken(phraseTokens);
		const phraseIds = await ensureTokenLoaded(phraseToken, {
			signal,
			returnNullOn404: true,
			returnNullOn403: true,
			onProgress
		});

		if (Array.isArray(phraseIds) && phraseIds.length > 0) {
			if (baseIdsSet) {
				return phraseIds.filter(id => baseIdsSet.has(id));
			}
			return phraseIds;
		}
	}

	// Fallback to regex search through full dataset
	const datasetMap = await ensureFullDatasetMap({ signal, onProgress });
	if (!isActiveSearch(runId)) return [];

	const phraseRegex = buildPhraseRegex(phrase, 'i');
	const tokenRegex = buildExactTokenRegex(phrase, 'i');
	const chosenRegex = phraseRegex || tokenRegex;

	if (!chosenRegex) return [];

	const candidateIds = baseIds.length > 0 ? baseIds : Array.from(datasetMap.keys());
	const matchedIds = [];

	for (const id of candidateIds) {
		if (!isActiveSearch(runId)) return [];
		const item = await getArticleForSearch(id, datasetMap);
		const haystacks = [item?.title, item?.org, item?.content];
		const hasMatch = haystacks.some((field) => {
			if (typeof field !== 'string') return false;
			chosenRegex.lastIndex = 0;
			return chosenRegex.test(field);
		});
		if (hasMatch) matchedIds.push(id);
	}

	return matchedIds;
};

/**
 * Get IDs matching words (OR logic with scoring)
 * Returns { ids: string[], scoreMap: Map<string, number> }
 */
const getWordMatchIds = async (words, baseIds, baseIdsSet, ensureTokenLoaded, signal, isActiveSearch, runId, onProgress) => {
	const uniqueWords = Array.from(new Set(words));
	const tokenMap = new Map();

	// Load each word's results
	for (const word of uniqueWords) {
		if (!isActiveSearch(runId)) return { ids: [], scoreMap: new Map() };
		const ids = await ensureTokenLoaded(word, { signal, onProgress });
		if (Array.isArray(ids) && ids.length > 0) {
			tokenMap.set(word, ids);
		}
	}

	if (tokenMap.size === 0) {
		return { ids: [], scoreMap: new Map() };
	}

	// Build score map (count how many words match each document)
	const scoreMap = new Map();
	for (const word of uniqueWords) {
		const ids = tokenMap.get(word);
		if (!Array.isArray(ids)) continue;
		for (const id of ids) {
			if (baseIdsSet && !baseIdsSet.has(id)) continue;
			const prev = scoreMap.get(id) || 0;
			scoreMap.set(id, prev + 1);
		}
	}

	// Get all matching IDs
	const allIds = Array.from(scoreMap.keys());
	return { ids: allIds, scoreMap };
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

	/**
	 * Recursively evaluate a parsed query node
	 * Returns { ids: string[], scoreMap: Map<string, number> }
	 */
	const evaluateQueryNode = async (node, baseIds, baseIdsSet, signal, runId, onProgress) => {
		if (!node || node.type === 'empty') {
			return { ids: baseIds, scoreMap: new Map() };
		}

		if (node.type === 'word') {
			// Single word search
			const result = await getWordMatchIds(
				[node.value],
				baseIds,
				baseIdsSet,
				ensureTokenLoaded,
				signal,
				isActiveSearch,
				runId,
				onProgress
			);
			return result;
		}

		if (node.type === 'phrase') {
			// Exact phrase search
			const ids = await getPhraseMatchIds(
				node.value,
				baseIds,
				baseIdsSet,
				ensureTokenLoaded,
				ensureFullDatasetMap,
				getArticleForSearch,
				signal,
				isActiveSearch,
				runId,
				onProgress
			);
			// Phrases get score of 1 for each match
			const scoreMap = new Map();
			ids.forEach(id => scoreMap.set(id, 1));
			return { ids, scoreMap };
		}

		if (node.type === 'or') {
			// OR: union of all terms with combined scoring
			const allScores = new Map();
			const allIds = new Set();

			// Collect all words for word-based search
			const allWords = [];
			const phraseTerms = [];

			const collectTerms = (n) => {
				if (n.type === 'word') {
					allWords.push(n.value);
				} else if (n.type === 'phrase') {
					phraseTerms.push(n);
				} else if (n.type === 'and') {
					// AND groups within OR - evaluate separately
					phraseTerms.push(n);
				} else if (n.type === 'or' && n.terms) {
					n.terms.forEach(collectTerms);
				}
			};

			if (node.terms) {
				node.terms.forEach(collectTerms);
			}

			// Handle words with OR logic and scoring
			if (allWords.length > 0) {
				const wordResult = await getWordMatchIds(
					allWords,
					baseIds,
					baseIdsSet,
					ensureTokenLoaded,
					signal,
					isActiveSearch,
					runId,
					onProgress
				);
				if (!isActiveSearch(runId)) return { ids: [], scoreMap: new Map() };

				wordResult.ids.forEach(id => allIds.add(id));
				wordResult.scoreMap.forEach((score, id) => {
					allScores.set(id, (allScores.get(id) || 0) + score);
				});
			}

			// Handle phrases and AND groups
			for (const term of phraseTerms) {
				if (!isActiveSearch(runId)) return { ids: [], scoreMap: new Map() };

				const termResult = await evaluateQueryNode(term, baseIds, baseIdsSet, signal, runId, onProgress);
				termResult.ids.forEach(id => allIds.add(id));
				termResult.scoreMap.forEach((score, id) => {
					allScores.set(id, (allScores.get(id) || 0) + score);
				});
			}

			return { ids: Array.from(allIds), scoreMap: allScores };
		}

		if (node.type === 'and') {
			// AND: intersection of all terms
			if (!node.terms || node.terms.length === 0) {
				return { ids: [], scoreMap: new Map() };
			}

			// Evaluate first term
			let result = await evaluateQueryNode(node.terms[0], baseIds, baseIdsSet, signal, runId, onProgress);
			if (!isActiveSearch(runId)) return { ids: [], scoreMap: new Map() };

			let currentIds = new Set(result.ids);
			const combinedScores = new Map(result.scoreMap);

			// Intersect with remaining terms
			for (let i = 1; i < node.terms.length; i++) {
				if (!isActiveSearch(runId)) return { ids: [], scoreMap: new Map() };

				const termResult = await evaluateQueryNode(node.terms[i], baseIds, baseIdsSet, signal, runId, onProgress);
				const termIdSet = new Set(termResult.ids);

				// Keep only IDs that appear in both sets
				const intersection = new Set();
				currentIds.forEach(id => {
					if (termIdSet.has(id)) intersection.add(id);
				});
				currentIds = intersection;

				// Add scores for IDs in intersection
				termResult.scoreMap.forEach((score, id) => {
					if (currentIds.has(id)) {
						combinedScores.set(id, (combinedScores.get(id) || 0) + score);
					}
				});
			}

			// Filter scores to only include IDs in final intersection
			const finalScores = new Map();
			currentIds.forEach(id => {
				finalScores.set(id, combinedScores.get(id) || 1);
			});

			return { ids: Array.from(currentIds), scoreMap: finalScores };
		}

		// Unknown type - return empty
		return { ids: [], scoreMap: new Map() };
	};

	const applyFiltersAndSearch = async (searchTerm, callbacks = {}) => {
		const {
			onSearchProgress = null,
			onExactMatchActive = null
		} = callbacks;
		const { runId, signal } = startSearchRun();
		const baseIds = await getBaseIdsFromFilters();
		const hasBaseIds = baseIds.length > 0;
		const baseIdsSet = hasBaseIds ? new Set(baseIds) : null;

		// Parse the search query
		const parsed = parseSearchQuery(searchTerm);

		// Check if this involves phrase search (for UI indicator)
		const hasPhraseSearch = (node) => {
			if (!node) return false;
			if (node.type === 'phrase') return true;
			if (node.type === 'or' || node.type === 'and') {
				return node.terms?.some(hasPhraseSearch) || false;
			}
			return false;
		};
		if (onExactMatchActive) onExactMatchActive(hasPhraseSearch(parsed));

		// Handle empty search
		if (parsed.type === 'empty') {
			return { activeIds: baseIds, expectedTotalCount: baseIds.length };
		}

		// Progress handler
		const progressHandler = onSearchProgress
			? (loaded, total) => {
					if (total > 0) onSearchProgress(Math.min(1, loaded / total));
				}
			: null;

		// Evaluate the query
		const result = await evaluateQueryNode(parsed, baseIds, baseIdsSet, signal, runId, progressHandler);
		if (!isActiveSearch(runId)) return null;

		const { ids, scoreMap } = result;

		if (ids.length === 0) {
			return { activeIds: [], expectedTotalCount: 0 };
		}

		// Sort by score (highest first)
		const buckets = new Map();
		for (const id of ids) {
			const score = scoreMap.get(id) || 1;
			if (!buckets.has(score)) buckets.set(score, []);
			buckets.get(score).push(id);
		}

		const sortedScores = [...buckets.keys()].sort((a, b) => b - a);
		const sortedIds = [];
		for (const score of sortedScores) {
			sortedIds.push(...buckets.get(score));
		}

		return { activeIds: sortedIds, expectedTotalCount: sortedIds.length };
	};

	return {
		applyFiltersAndSearch
	};
};
