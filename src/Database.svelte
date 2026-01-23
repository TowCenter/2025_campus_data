<script>
  /**
   * Database Component
   *
   * This component displays the searchable, filterable database of university responses.
   * Data is stored in AWS S3 and loaded incrementally for performance.
   *
   * Data Architecture:
   * - month_index/{year}.json: Per-year month to article IDs for chronological filtering
   * - institution_index.json: Maps institutions to article IDs for institution filtering
   * - articles/: Individual JSON files per article, loaded on demand
   * - search_index/: Pre-built search indices for fast keyword matching
   * - data.json: Full dataset, loaded only for large exports or exact phrase searches
   *
   * Key Features:
   * - Multi-select month and institution filters
   * - Full-text search with exact phrase matching (using quotes)
   * - Pagination with configurable page size
   * - CSV export functionality
   * - Lazy loading of article data for performance
   *
   * Svelte 5 Migration Notes:
   * - All event handlers converted from on:click to onclick
   * - Event modifiers (preventDefault, stopPropagation) are now explicit calls
   * - All other Svelte features (bind:, reactive statements, etc.) work unchanged
   */

  import { onMount } from 'svelte';

  // AWS S3 data URLs - all data is hosted in a public S3 bucket
  const MONTH_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/month_index';
  const MONTH_INDEX_MANIFEST_URL = `${MONTH_INDEX_BASE_URL}/manifest.json`; // { "2025": { "2025-12": count, ... }, ... }
  const INSTITUTION_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/institution_index';
  const INSTITUTION_INDEX_MANIFEST_URL = `${INSTITUTION_INDEX_BASE_URL}/manifest.json`;
  const ARTICLE_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/articles';
  const SEARCH_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/search_index';
  const FULL_DATA_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';
  const MIN_YEAR = 2025;

  // Performance threshold: if export exceeds this many items, load full dataset at once
  const EXPORT_FULL_DATA_THRESHOLD = 1000;

  // Special keys for items without dates or organizations
  const NO_DATE_KEY = '_no_date';
  const MONTH_INDEX_NO_DATE_URL = `${MONTH_INDEX_BASE_URL}/${NO_DATE_KEY}.json`;
  const NO_ORG_KEY = '_no_org';

  // monthIndex: { "YYYY-MM": ["id1","id2",...], "_no_date": ["idX",...] }
  let monthIndex = {};
  // institutionIndex: { "Harvard University": ["id1","id2",...], "_no_org": [...] }
  let institutionIndex = {};
  let institutionIndexReady = false;
  let institutionIndexLoading = false;
  let institutionIndexError = null;
  let institutionIndexPromise = null;
  let monthFiltersReady = false;
  let manifestMonthCounts = new Map();
  let institutionShards = null;

  let months = [];        // real months only, e.g. ["2025-11","2025-10",...]
  let institutions = [];  // institution names (no _no_org)

  let noDateIds = [];     // from monthIndex[NO_DATE_KEY] if present
  let noDateLoaded = true; // ignore no-date bucket for display
  let resultsSectionEl = null;

  // Filters (multi-select)
  let selectedMonths = [];        // [] = all months
  let selectedInstitutions = [];  // [] = all institutions

  // Dropdown state
  let institutionDropdownOpen = false;
  let monthDropdownOpen = false;
  let institutionSearchTerm = '';
  let monthSearchTerm = '';

  // Ordered list of all IDs for the global timeline
  let globalIds = [];

  // IDs after applying filters and search
  let activeIds = [];

  // Current page's articles
  let articles = [];

  // Loading / error state
  let loading = true;
  let loadingArticles = false;
  let error = null;

  // Pagination
  let currentPage = 1;
  const pageSize = 20;
  let totalPages = 1;
  let gotoPage = 1;
  let expectedTotalCount = 0;

  // Caching
  let initialized = false;
  const loadedMonthFiles = new Set();
  let backgroundMonthLoad = null;

  // Cache of article JSONs
  const articleCache = new Map();

  // --- Search state (using search_index shards) ---
  let searchTerm = '';
  let searchLoading = false;
  let searchError = null;
  let searchTimeout;
  let searchProgress = 0;
  let searchAbortController = null;
  let searchRunId = 0;
  let exporting = false;
  let exportProgress = 0;
  // shardKey -> { token: [ids...] }
  const searchShardCache = new Map();
  let fullDatasetCache = null;
  let fullDatasetMap = null;

  $: quotedPhraseDisplay = getQuotedPhrase(searchTerm);
  $: exactMatchActive = Boolean(quotedPhraseDisplay);
  $: searchPercent = Math.round(Math.min(Math.max(searchProgress, 0), 1) * 100);
  $: searchMatchDescription = (() => {
    const trimmedTerm = (searchTerm || '').trim();
    if (!trimmedTerm) return '';

    if (exactMatchActive && quotedPhraseDisplay) {
      return `matching exact phrase “${quotedPhraseDisplay}”`;
    }

    const tokens = getSearchTokens(trimmedTerm);
    if (tokens.length > 1) {
      return `matching ${tokens.map((t) => `"${t}"`).join(' OR ')}`;
    }

    return `matching “${trimmedTerm}”`;
  })();

  $: filteredInstitutions = institutionIndexReady
          ? institutionSearchTerm
                  ? institutions.filter((inst) =>
                          inst.toLowerCase().includes(institutionSearchTerm.toLowerCase())
                  )
                  : institutions
          : [];

  $: filteredMonths = monthSearchTerm
          ? months.filter((month) => {
            const label = formatMonthLabel(month).toLowerCase();
            const search = monthSearchTerm.toLowerCase();
            return label.includes(search) || month.toLowerCase().includes(search);
          })
          : months;

  $: showNoDateOption =
          monthSearchTerm.trim() === ''
                  ? true
                  : 'no date'.includes(monthSearchTerm.toLowerCase());

  // Track time spent on Database page
  let pageStartTime;

  onMount(async () => {
    pageStartTime = Date.now();

    if (!initialized) {
      // First time visiting the tab: fetch everything
      await loadInitialData();
    } else {
      // Coming back to the tab: reuse existing data
      loading = false;          // don't show "Loading database..." again
      error = null;
      // Optionally re-apply filters & search based on existing state:
      await applyFiltersAndSearch();
    }

    // Track time on page when user leaves
    return () => {
      if (window.umami && pageStartTime) {
        const timeSpent = Math.round((Date.now() - pageStartTime) / 1000); // seconds
        window.umami.track('database-time-spent', {
          seconds: timeSpent,
          minutes: Math.round(timeSpent / 60)
        });
      }
    };
  });

  async function loadInitialData() {
    // if already initialized, don't fetch again
    if (initialized) return;

    loading = true;
    error = null;
    monthFiltersReady = false;

    try {
      // load month index first for fast first render; institutions load in background
      const { remainingYears, fromManifest, loadErrors } = await loadMonthIndex();
      monthFiltersReady = (!remainingYears || remainingYears.length === 0) && noDateLoaded;

      // only set default filters on first successful load
      selectedMonths = [];
      selectedInstitutions = [];
      searchTerm = '';

      await applyFiltersAndSearch();

      initialized = true;  // mark as ready after success

      // now that first page is ready, start background loads
      startBackgroundMonthLoad(remainingYears, fromManifest, loadErrors);
      // start background load of institution index
      startInstitutionIndexLoad();
    } catch (e) {
      console.error(e);
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function sortYearsDesc(years) {
    return Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));
  }

  async function getMonthIndexYears() {
    try {
      const res = await fetch(MONTH_INDEX_MANIFEST_URL);
      if (!res.ok) {
        throw new Error(`Failed to load manifest: ${res.status}`);
      }

      const manifestData = await res.json();

      const years = Object.keys(manifestData).filter(
              (key) => /^\d{4}$/.test(key) && Number(key) >= MIN_YEAR
      );

      if (years.length > 0) {
        return {
          years: sortYearsDesc(years),
          fromManifest: true,
          manifest: manifestData
        };
      }
    } catch (e) {
      console.warn('Failed to load month index manifest', e);
    }

    throw new Error('Month index manifest not available');
  }

  function mergeMonthData(data) {
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
  }

  function finalizeMonthIndex() {
    const manifestKeys = Array.from(manifestMonthCounts.keys());
    const allKeys = Array.from(new Set([...Object.keys(monthIndex), ...manifestKeys]));

    // months = all keys except NO_DATE_KEY, newest → oldest
    months = allKeys
            .filter((k) => {
              if (k === NO_DATE_KEY) return false;
              const year = Number((k || '').split('-')[0]);
              return Number.isFinite(year) && year >= MIN_YEAR;
            })
            .sort()
            .reverse();

    // globalIds = all dated months (newest → oldest), then no-date
    globalIds = [];
    for (const month of months) {
      const ids = monthIndex[month];
      if (Array.isArray(ids)) {
        globalIds.push(...ids);
      }
    }
    noDateIds = []; // exclude no-date bucket from filters/results
  }

  async function loadMonthIndexFile(year) {
    const res = await fetch(`${MONTH_INDEX_BASE_URL}/${year}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load month index ${year}: ${res.status}`);
    }
    const data = await res.json();
    return data;
  }

  function normalizeNoDateData(data) {
    if (Array.isArray(data)) {
      return { [NO_DATE_KEY]: data };
    }
    if (data && typeof data === 'object' && Array.isArray(data[NO_DATE_KEY])) {
      return { [NO_DATE_KEY]: data[NO_DATE_KEY] };
    }
    return null;
  }

  async function loadNoDateIndex() {
    try {
      const res = await fetch(MONTH_INDEX_NO_DATE_URL);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Failed to load no-date index: ${res.status}`);
      }

      const normalized = normalizeNoDateData(await res.json());
      if (!normalized) {
        console.warn('No-date index returned unexpected format');
        return null;
      }

      return normalized;
    } catch (e) {
      console.warn('Failed to load no-date index', e);
      return null;
    }
  }

  async function loadMonthIndex() {
    const { years: yearsToLoad, fromManifest, manifest } = await getMonthIndexYears();
    if (!yearsToLoad || yearsToLoad.length === 0) {
      throw new Error('No month indexes available');
    }

    manifestMonthCounts = new Map();
    if (manifest) {
      for (const [yearKey, yearData] of Object.entries(manifest)) {
        if (!/^\d{4}$/.test(yearKey) || Number(yearKey) < MIN_YEAR) continue;
        if (yearData && typeof yearData === 'object') {
          for (const [key, count] of Object.entries(yearData)) {
            const year = Number((key || '').split('-')[0]);
            if (Number.isFinite(year) && year >= MIN_YEAR) {
              manifestMonthCounts.set(key, count);
            }
          }
        }
      }
    }

    const sortedYears = sortYearsDesc(yearsToLoad);
    const [newestYear, ...otherYears] = sortedYears;
    if (!newestYear) {
      throw new Error('No month indexes available');
    }

    const initialYears = [newestYear];
    const remainingYears = otherYears;
    const loadErrors = [];

    for (const year of initialYears) {
      try {
        const data = await loadMonthIndexFile(year);
        loadedMonthFiles.add(year);
        mergeMonthData(data);
      } catch (e) {
        loadErrors.push(e);
      }
    }

    finalizeMonthIndex();

    if (Object.keys(monthIndex).length === 0) {
      const message = loadErrors[0]?.message || 'Failed to load month indexes';
      throw new Error(message);
    }

    return { remainingYears, fromManifest, loadErrors };
  }

  function startBackgroundMonthLoad(remainingYears, fromManifest, loadErrors = []) {
    const needsNoDate = !noDateLoaded;
    if ((!remainingYears || remainingYears.length === 0) && !needsNoDate) return;
    backgroundMonthLoad = (async () => {
      const tasks = [];
      if (remainingYears && remainingYears.length > 0) {
        tasks.push(
                ...remainingYears.map((year) =>
                        loadMonthIndexFile(year).then((data) => ({ type: 'monthFile', year, data }))
                )
        );
      }
      if (needsNoDate) {
        tasks.push(
                loadNoDateIndex().then((data) => ({ type: 'noDate', data }))
        );
      }

      const backgroundResults = await Promise.allSettled(tasks);

      let updated = false;
      for (const result of backgroundResults) {
        if (result.status === 'fulfilled') {
          const payload = result.value;
          if (payload.type === 'monthFile') {
            const { year, data } = payload;
            if (!loadedMonthFiles.has(year)) {
              loadedMonthFiles.add(year);
              updated = mergeMonthData(data) || updated;
            }
          } else if (payload.type === 'noDate') {
            noDateLoaded = true;
            const normalized = normalizeNoDateData(payload.data);
            if (normalized) {
              updated = mergeMonthData(normalized) || updated;
            }
          }
        } else {
          loadErrors.push(result.reason);
        }
      }

      if (updated) {
        finalizeMonthIndex();
        await applyFiltersAndSearch();
      }

      if (loadErrors.length > 0 && fromManifest) {
        console.warn('Some month index files failed to load', loadErrors);
      }
      monthFiltersReady = true;
    })();
  }

  async function loadInstitutionShard(shard) {
    const url = `${INSTITUTION_INDEX_BASE_URL}/${shard}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load institution index shard ${shard}: ${res.status}`);
    }
    return res.json();
  }

  async function getInstitutionShards() {
    if (Array.isArray(institutionShards) && institutionShards.length > 0) {
      return institutionShards;
    }

    try {
      const res = await fetch(INSTITUTION_INDEX_MANIFEST_URL);
      if (!res.ok) {
        throw new Error(`Failed to load institution manifest: ${res.status}`);
      }

      const manifest = await res.json();
      const shards = Object.keys(manifest || {}).filter(
              (key) => manifest[key] && typeof manifest[key] === 'object'
      );

      if (shards.length === 0) {
        throw new Error('Institution manifest is empty');
      }

      institutionShards = shards;
      return institutionShards;
    } catch (e) {
      console.warn('Failed to load institution manifest', e);
      institutionShards = null;
      throw e;
    }
  }

  async function loadInstitutionIndex() {
    institutionIndexLoading = true;
    institutionIndexError = null;

    try {
      const shards = await getInstitutionShards();
      if (!shards || shards.length === 0) {
        throw new Error('Institution index manifest not available');
      }

      const results = await Promise.allSettled(
              shards.map((shard) =>
                      loadInstitutionShard(shard).then((data) => ({ shard, data }))
              )
      );

      const merged = {};
      const errors = [];

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { data } = result.value;
          if (data && typeof data === 'object') {
            Object.assign(merged, data);
          }
        } else {
          errors.push(result.reason);
        }
      }

      if (Object.keys(merged).length === 0) {
        throw errors[0] || new Error('Institution index shards not available');
      }

      institutionIndex = merged;
      institutions = Object.keys(institutionIndex)
              .filter((k) => k !== NO_ORG_KEY)
              .sort((a, b) => a.localeCompare(b));
      institutionIndexReady = true;
      return institutionIndex;
    } catch (e) {
      console.error(e);
      institutionIndexError = e.message;
      throw e;
    } finally {
      institutionIndexLoading = false;
    }
  }

  function startInstitutionIndexLoad() {
    if (institutionIndexReady || institutionIndexLoading) return institutionIndexPromise;
    institutionIndexPromise = loadInstitutionIndex().catch(() => null);
    return institutionIndexPromise;
  }

  // --- Filtering helpers (month + institution) ---

  function getBaseIdsFromFilters() {
    let baseIds = [];

    // 1) Month (multi-select)
    if (selectedMonths.length === 0) {
      baseIds = globalIds;
    } else {
      const monthSet = new Set(selectedMonths);
      const orderedMonths = months.filter((m) => monthSet.has(m));

      for (const month of orderedMonths) {
        const ids = monthIndex[month];
        if (Array.isArray(ids)) {
          baseIds.push(...ids);
        }
      }

      if (monthSet.has(NO_DATE_KEY) && noDateIds.length) {
        baseIds.push(...noDateIds);
      }
    }

    // 2) Institution (multi-select)
    if (selectedInstitutions.length === 0) {
      return baseIds;
    }

    const instIdSet = new Set();
    for (const inst of selectedInstitutions) {
      const ids = institutionIndex[inst];
      if (Array.isArray(ids)) {
        ids.forEach((id) => instIdSet.add(id));
      }
    }

    if (instIdSet.size === 0) {
      return [];
    }

    return baseIds.filter((id) => instIdSet.has(id));
  }

  function computeExpectedTotal(baseIds) {
    const hasSearch = Boolean((searchTerm || '').trim());
    if (hasSearch || selectedInstitutions.length > 0 || monthFiltersReady) {
      return baseIds.length;
    }

    const monthCount = (key) => {
      const manifestVal = manifestMonthCounts.get(key);
      if (typeof manifestVal === 'number' && manifestVal >= 0) return manifestVal;
      const ids = monthIndex[key];
      return Array.isArray(ids) ? ids.length : 0;
    };

    if (selectedMonths.length === 0) {
      const manifestCount = Array.from(manifestMonthCounts.values()).reduce(
              (sum, val) => sum + (Number(val) || 0),
              0
      );
      return Math.max(baseIds.length, manifestCount);
    }

    const total = Array.from(new Set(selectedMonths)).reduce(
            (sum, month) => sum + monthCount(month),
            0
    );
    return Math.max(baseIds.length, total);
  }

  // --- Search index helpers ---

  function getShardKey(term) {
    if (!term) return null;
    const first = term[0].toLowerCase();
    if (first >= 'a' && first <= 'z') return first;
    return null; // no shard for non-letter queries
  }

  function startSearchRun() {
    searchRunId += 1;
    if (searchAbortController) {
      searchAbortController.abort();
    }
    searchAbortController = new AbortController();
    return { runId: searchRunId, signal: searchAbortController.signal };
  }

  function isActiveSearch(runId) {
    return runId === searchRunId;
  }

  function isAbortError(error) {
    return error && error.name === 'AbortError';
  }

  async function ensureShardLoaded(shardKey, onProgress = null, options = {}) {
    if (!shardKey) return null;

    if (searchShardCache.has(shardKey)) {
      return searchShardCache.get(shardKey);
    }

    try {
      const shard = await fetchJsonWithProgress(
              `${SEARCH_INDEX_BASE_URL}/${shardKey}.json`,
              onProgress,
              {
                ...options,
                errorLabel: options.errorLabel || `search index shard '${shardKey}'`
              }
      );
      searchShardCache.set(shardKey, shard);
      return shard;
    } catch (e) {
      if (isAbortError(e)) return null;
      console.error(e);
      searchError = e.message;
      return null;
    }
  }

  // --- Core: apply filters + search, set activeIds, then page 1 ---

  // Allow multi-word search; strip wrapping quotes from individual tokens
  function getSearchTokens(raw) {
    return raw
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .map((t) => t.replace(/^"+|"+$/g, ''))
            .filter(Boolean);
  }

  // If the entire term is quoted, return the inner phrase
  function getQuotedPhrase(raw) {
    const trimmed = (raw || '').trim();
    const match = trimmed.match(/^"(.*)"$/);
    if (!match) return null;
    const phrase = match[1].trim();
    return phrase || null;
  }

  async function applyFiltersAndSearch() {
    const { runId, signal } = startSearchRun();
    const baseIds = getBaseIdsFromFilters();
    const baseIdsSet = new Set(baseIds);
    const quotedPhrase = getQuotedPhrase(searchTerm);
    const phraseTokens = quotedPhrase ? getSearchTokens(quotedPhrase) : [];
    const useExactPhraseSearch = quotedPhrase && phraseTokens.length > 1;
    expectedTotalCount = computeExpectedTotal(baseIds);
    searchProgress = 0;

    if (useExactPhraseSearch) {
      searchLoading = true;
      searchError = null;

      try {
        const progressHandler = (loaded, total) => {
          if (!isActiveSearch(runId)) return;
          if (total && total > 0) {
            searchProgress = Math.min(1, loaded / total);
          } else {
            searchProgress = Math.min(0.95, searchProgress + 0.02);
          }
        };
        const shouldTrackProgress = !fullDatasetCache && !fullDatasetMap;
        const datasetMap = await ensureFullDatasetMap(
                shouldTrackProgress ? progressHandler : null,
                { signal }
        );
        if (!isActiveSearch(runId)) return;
        searchProgress = 1;
        const phraseRegex = new RegExp(`(^|\\b)${escapeRegExp(quotedPhrase)}(\\b|$)`, 'i');
        const matchedIds = [];

        for (const id of baseIds) {
          if (!isActiveSearch(runId)) return;
          let item;
          try {
            item = await getArticleForSearch(id, datasetMap);
          } catch (e) {
            console.error(e);
            continue;
          }

          const haystacks = [item?.title, item?.org, item?.content];
          const hasMatch = haystacks.some(
                  (field) => typeof field === 'string' && phraseRegex.test(field)
          );

          if (hasMatch) {
            matchedIds.push(id);
          }
        }

        if (!isActiveSearch(runId)) return;
        activeIds = matchedIds;
        expectedTotalCount = matchedIds.length;
        currentPage = 1;
        if (!isActiveSearch(runId)) return;
        await loadPage(1, { runId });
      } catch (e) {
        if (isAbortError(e)) return;
        console.error(e);
        searchError = e.message;
        activeIds = [];
        expectedTotalCount = 0;
        currentPage = 1;
        if (!isActiveSearch(runId)) return;
        await loadPage(1, { runId });
      } finally {
        if (isActiveSearch(runId)) {
          searchLoading = false;
        }
      }
      return;
    }

    const tokens = getSearchTokens(searchTerm);

    // No search term: just filtered timeline
    if (tokens.length === 0) {
      searchProgress = 0;
      searchLoading = false;
      activeIds = baseIds;
      currentPage = 1;
      await loadPage(1, { runId });
      return;
    }

    // unique shard keys (one per first letter)
    const shardKeys = Array.from(
            new Set(
                    tokens
                            .map((t) => getShardKey(t))
                            .filter((k) => k !== null)
            )
    );

    if (shardKeys.length === 0) {
      searchProgress = 0;
      searchLoading = false;
      activeIds = [];
      currentPage = 1;
      await loadPage(1, { runId });
      return;
    }

    searchLoading = true;
    searchError = null;

    // load all needed shards
    const shardMap = new Map();
    const totalShards = shardKeys.length;
    let loadedShards = 0;
    const updateProgress = (currentShardProgress) => {
      if (!isActiveSearch(runId)) return;
      const normalized = Math.min(Math.max(currentShardProgress, 0), 1);
      searchProgress = Math.min(1, (loadedShards + normalized) / Math.max(totalShards, 1));
    };

    try {
      for (const key of shardKeys) {
        if (!isActiveSearch(runId)) return;
        if (searchShardCache.has(key)) {
          loadedShards += 1;
          updateProgress(0);
          shardMap.set(key, searchShardCache.get(key));
          continue;
        }

        let shardProgress = 0;
        const shard = await ensureShardLoaded(key, (loaded, total) => {
          if (!isActiveSearch(runId)) return;
          if (total && total > 0) {
            shardProgress = loaded / total;
          } else {
            shardProgress = Math.min(0.95, shardProgress + 0.02);
          }
          updateProgress(shardProgress);
        }, { signal });
        if (!isActiveSearch(runId)) return;
        loadedShards += 1;
        updateProgress(0);
        if (shard) {
          shardMap.set(key, shard);
        }
      }

      if (shardMap.size === 0) {
        if (!isActiveSearch(runId)) return;
        activeIds = [];
        expectedTotalCount = 0;
        currentPage = 1;
        if (!isActiveSearch(runId)) return;
        await loadPage(1, { runId });
        return;
      }

      // Exact-match search; score by how many tokens an item matches, ordered by score then date
      const scoreMap = new Map(); // id -> count of matched tokens

      for (const term of tokens) {
        const key = getShardKey(term);
        if (!key) continue;

        const shard = shardMap.get(key);
        if (!shard) continue;

        const ids = shard[term];
        if (!Array.isArray(ids)) continue;

        for (const id of ids) {
          if (!baseIdsSet.has(id)) continue; // respect filters
          const prev = scoreMap.get(id) || 0;
          scoreMap.set(id, prev + 1);
        }
      }

      if (scoreMap.size === 0) {
        if (!isActiveSearch(runId)) return;
        activeIds = [];
        expectedTotalCount = 0;
        currentPage = 1;
        if (!isActiveSearch(runId)) return;
        await loadPage(1, { runId });
        return;
      }

      const buckets = new Map(); // score -> ids in base order
      for (const id of baseIds) {
        const score = scoreMap.get(id);
        if (!score) continue;
        if (!buckets.has(score)) buckets.set(score, []);
        buckets.get(score).push(id);
      }

      if (buckets.size === 0) {
        if (!isActiveSearch(runId)) return;
        activeIds = [];
        expectedTotalCount = 0;
        currentPage = 1;
        if (!isActiveSearch(runId)) return;
        await loadPage(1, { runId });
        return;
      }

      const sortedScores = [...buckets.keys()].sort((a, b) => b - a);
      const filteredBySearch = [];
      for (const score of sortedScores) {
        filteredBySearch.push(...buckets.get(score));
      }

      if (!isActiveSearch(runId)) return;
      activeIds = filteredBySearch;
      expectedTotalCount = activeIds.length;
      currentPage = 1;
      if (!isActiveSearch(runId)) return;
      await loadPage(1, { runId });
    } finally {
      if (isActiveSearch(runId)) {
        searchLoading = false;
      }
    }
  }

    // --- Paging + article loading ---

  async function getArticleById(id) {
    if (articleCache.has(id)) return articleCache.get(id);

    const res = await fetch(`${ARTICLE_BASE_URL}/${id}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load article ${id}: ${res.status}`);
    }

    const data = await res.json();
    articleCache.set(id, data);
    return data;
  }

  async function loadPage(page, options = {}) {
    const { runId = null } = options;
    const isActiveRun = () => runId === null || isActiveSearch(runId);
    if (!isActiveRun()) return;

    const ids = activeIds;
    const totalCount = Math.max(ids?.length || 0, expectedTotalCount || 0);

    if (!ids || ids.length === 0) {
      if (!isActiveRun()) return;
      articles = [];
      currentPage = 1;
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      gotoPage = 1;
      return;
    }

    const newTotalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page < 1) page = 1;
    if (page > newTotalPages) page = newTotalPages;

    currentPage = page;
    totalPages = newTotalPages;
    gotoPage = currentPage;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageIds = ids.slice(start, end);

    if (!isActiveRun()) return;
    loadingArticles = true;
    error = null;

    try {
      const promises = pageIds.map((id) => getArticleById(id));

      const nextArticles = await Promise.all(promises);
      if (!isActiveRun()) return;
      articles = nextArticles;
    } catch (e) {
      if (!isActiveRun()) return;
      console.error(e);
      error = e.message;
    } finally {
      if (isActiveRun()) {
        loadingArticles = false;
      }
    }
  }

  async function toggleMonth(month, checked) {
    if (checked) {
      if (!selectedMonths.includes(month)) {
        selectedMonths = [...selectedMonths, month];
      }
    } else {
      selectedMonths = selectedMonths.filter((m) => m !== month);
    }

    // Track month filter usage
    if (window.umami) {
      window.umami.track('filter-month', {
        action: checked ? 'add' : 'remove',
        month: month,
        total_selected: selectedMonths.length
      });
    }

    currentPage = 1;
    await applyFiltersAndSearch();
  }

  async function toggleInstitution(inst, checked) {
    if (checked) {
      if (!selectedInstitutions.includes(inst)) {
        selectedInstitutions = [...selectedInstitutions, inst];
      }
    } else {
      selectedInstitutions = selectedInstitutions.filter((i) => i !== inst);
    }

    // Track institution filter usage
    if (window.umami) {
      window.umami.track('filter-institution', {
        action: checked ? 'add' : 'remove',
        institution: inst,
        total_selected: selectedInstitutions.length
      });
    }

    currentPage = 1;
    await applyFiltersAndSearch();
  }

  async function clearMonths() {
    selectedMonths = [];
    currentPage = 1;
    await applyFiltersAndSearch();
  }

  async function clearInstitutions() {
    selectedInstitutions = [];
    currentPage = 1;
    await applyFiltersAndSearch();
  }

  // Timeline month click handler
  async function handleTimelineMonthClick(monthKey) {
    // Toggle: if this month is already selected, deselect it (show all)
    if (selectedMonths.length === 1 && selectedMonths[0] === monthKey) {
      selectedMonths = [];
    } else {
      // Otherwise, select only this month
      selectedMonths = [monthKey];
    }

    currentPage = 1;
    await applyFiltersAndSearch();

    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSearchInput(event) {
    searchTerm = event.target.value;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      // Track search usage
      if (window.umami && searchTerm.trim().length > 0) {
        window.umami.track('search-query', {
          query_length: searchTerm.trim().length,
          has_quotes: searchTerm.includes('"'),
          has_filters: selectedMonths.length > 0 || selectedInstitutions.length > 0
        });
      }

      applyFiltersAndSearch();
    }, 1000); // debounce
  }

  const isUnfiltered = () =>
          selectedMonths.length === 0 &&
          selectedInstitutions.length === 0 &&
          !searchTerm.trim();

  /**
   * Set the search term from a quick search button and trigger filtering
   */
  async function quickSearch(term) {
    searchTerm = term;
    currentPage = 1;
    
    // Track quick search usage
    if (window.umami) {
      window.umami.track('quick-search', { term });
    }
    
    await applyFiltersAndSearch();
  }

  async function fetchJsonWithProgress(url, onProgress = null, options = {}) {
    const { errorLabel = 'data', signal = null } = options;
    const res = await fetch(url, signal ? { signal } : undefined);
    if (!res.ok) {
      throw new Error(`Failed to load ${errorLabel}: ${res.status}`);
    }

    const total = Number(res.headers.get('content-length')) || null;
    const reader = res.body?.getReader ? res.body.getReader() : null;
    if (!reader) {
      const data = await res.json();
      if (onProgress) onProgress(total || 1, total || 1);
      return data;
    }

    const decoder = new TextDecoder();
    let result = '';
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value?.length || 0;
      result += decoder.decode(value, { stream: true });
      if (onProgress) onProgress(loaded, total);
    }
    result += decoder.decode();
    if (onProgress) onProgress(total || loaded, total);
    return JSON.parse(result);
  }

  async function getFullDataset(onProgress = null, options = {}) {
    if (fullDatasetCache && !onProgress) return fullDatasetCache;

    const data = await fetchJsonWithProgress(FULL_DATA_URL, onProgress, {
      ...options,
      errorLabel: options.errorLabel || 'full dataset'
    });
    fullDatasetCache = data;
    return data;
  }

  function getItemId(item) {
    if (!item) return null;
    return item.id || item._id?.$oid || item._id || item.document_id || null;
  }

  async function ensureFullDatasetMap(onProgress = null, options = {}) {
    if (fullDatasetMap) return fullDatasetMap;
    const data = await getFullDataset(onProgress, options);
    const map = new Map();
    if (Array.isArray(data)) {
      data.forEach((item) => {
        const id = getItemId(item);
        if (id) {
          map.set(id, item);
        }
      });
    }
    fullDatasetMap = map;
    return fullDatasetMap;
  }

  async function getArticleForSearch(id, datasetMap) {
    if (articleCache.has(id)) return articleCache.get(id);
    if (datasetMap && datasetMap.has(id)) {
      const item = datasetMap.get(id);
      articleCache.set(id, item);
      return item;
    }
    const article = await getArticleById(id);
    return article;
  }

  function cleanDataForExport(data) {
    return data.map((item) => {
      const { llm_response, scraper, ...cleanItem } = item;
      return cleanItem;
    });
  }

  $: exportPercent = Math.round(Math.min(Math.max(exportProgress, 0), 1) * 100);

  async function exportResults() {
    if (!activeIds || activeIds.length === 0) {
      alert('No data to export');
      return;
    }

    exporting = true;
    exportProgress = 0;

    try {
      const useFullDataset =
              isUnfiltered() ||
              activeIds.length > EXPORT_FULL_DATA_THRESHOLD ||
              Boolean(fullDatasetCache);
      let articlesToExport;

      if (useFullDataset) {
        const progressHandler = (loaded, total) => {
          if (total && total > 0) {
            exportProgress = Math.min(0.95, loaded / total);
          } else {
            exportProgress = Math.min(0.95, exportProgress + 0.02);
          }
        };

        if (isUnfiltered()) {
          articlesToExport = await getFullDataset(progressHandler);
        } else {
          const datasetMap = await ensureFullDatasetMap(progressHandler);
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
          exportProgress = Math.min(1, completed / Math.max(total, 1));
          return article;
        };
        articlesToExport = await Promise.all(activeIds.map((id) => track(id)));
      }

      const cleanData = cleanDataForExport(articlesToExport);
      exportProgress = 1;
      await downloadCSV(cleanData);
    } catch (e) {
      console.error(e);
      alert('Error exporting data: ' + e.message);
    } finally {
      exporting = false;
      exportProgress = 0;
    }
  }

  async function downloadCSV(data) {
    if (!data.length) {
      alert('No data to export');
      return;
    }

    const allKeys = new Set();
    data.forEach((item) => {
      Object.keys(item).forEach((key) => allKeys.add(key));
    });

    const headers = Array.from(allKeys);

    function flattenValue(value) {
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        if (value.$oid) return value.$oid;
        if (value.$date) return new Date(value.$date).toISOString();
        return JSON.stringify(value).replace(/"/g, '""');
      }
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const csvContent = [
      headers.join(','),
      ...data.map((row) => headers.map((header) => flattenValue(row[header])).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `university_responses_filtered_${new Date().toISOString().split('T')[0]}.csv`);

    // Track download event in Umami
    if (window.umami) {
      window.umami.track('csv-download', {
        items_count: data.length,
        has_filters: !isUnfiltered(),
        has_search: searchTerm.length > 0,
        selected_months: selectedMonths.length,
        selected_institutions: selectedInstitutions.length
      });
    }
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  onMount(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.multi-select-dropdown')) {
        institutionDropdownOpen = false;
        monthDropdownOpen = false;
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  function scrollToResults() {
    if (!resultsSectionEl) return;
    resultsSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function changePage(newPage) {
    if (newPage < 1 || newPage > totalPages || loadingArticles) return;
    await loadPage(newPage);
    scrollToResults();
  }

  function formatMonthLabel(key) {
    if (!key || key === 'ALL') return 'All Months';
    if (key === NO_DATE_KEY) return 'No Date';

    const [yearStr, monthStr] = key.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return key;

    const d = new Date(Date.UTC(year, month - 1, 1));
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC'
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Date unknown';
    const d = new Date(dateStr);
    if (!isFinite(d)) return 'Date unknown';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
  }

  function buildExactTokenRegex(term, flags = 'gi') {
    const tokens = getSearchTokens(term);
    if (!tokens.length) return null;

    const patterns = tokens.map((token) => {
      const escaped = escapeRegExp(token);
      return /^[a-z0-9]+$/i.test(token) ? `\\b${escaped}\\b` : escaped;
    });

    return new RegExp(`(${patterns.join('|')})`, flags);
  }

  function buildPhraseRegex(term, flags = 'gi') {
    const tokens = getSearchTokens(term);
    if (tokens.length < 2) return null;

    const parts = tokens.map((token) => {
      const escaped = escapeRegExp(token);
      return /^[a-z0-9]+$/i.test(token) ? `\\b${escaped}\\b` : escaped;
    });

    return new RegExp(`(${parts.join('\\s+')})`, flags);
  }

  function highlight(text, term) {
    if (!text) return '';
    const phraseRegex = buildPhraseRegex(term, 'gi');
    const tokenRegex = buildExactTokenRegex(term, 'gi');
    if (!tokenRegex) return escapeHtml(text);

    let chosenRegex = tokenRegex;
    if (phraseRegex) {
      phraseRegex.lastIndex = 0;
      if (phraseRegex.test(text)) {
        chosenRegex = phraseRegex;
      }
      phraseRegex.lastIndex = 0;
    }

    const parts = text.split(chosenRegex);

    return parts
            .map((part, i) =>
                    i % 2 === 1
                            ? `<mark>${escapeHtml(part)}</mark>`
                            : escapeHtml(part)
            )
            .join('');
  }

  /**
   * Returns a snippet of `content`:
   * - if no term: first `maxLen` chars
   * - if term found: snippet centered around first occurrence, with some context
   */
  function getSnippet(content, term, maxLen = 280, context = 120) {
    if (!content) return '';

    const leadingSnippet = () => {
      let text = content.slice(0, maxLen);
      const lastSpace = text.lastIndexOf(' ');
      if (lastSpace > 0 && content.length > maxLen) {
        text = text.slice(0, lastSpace);
        return text + '…';
      }
      return content.length > maxLen ? text + '…' : text;
    };

    const phraseRegex = buildPhraseRegex(term, 'i');
    const tokenRegex = buildExactTokenRegex(term, 'i');
    const minContext = 30;

    if (!phraseRegex && !tokenRegex) {
      return leadingSnippet();
    }

    const collectMatches = (regex) => {
      if (!regex) return [];
      const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
      const globalRegex = new RegExp(regex.source, flags);
      const matches = [];
      let match;
      while ((match = globalRegex.exec(content)) !== null) {
        matches.push({ index: match.index, length: match[0].length, text: match[0] });
        if (match[0].length === 0) {
          globalRegex.lastIndex += 1;
        }
      }
      return matches;
    };

    const adjustWindow = (start, end) => {
      let s = Math.max(0, start);
      let e = Math.min(content.length, end);

      if (s > 0) {
        const prevSpace = content.lastIndexOf(' ', s);
        if (prevSpace !== -1) s = prevSpace + 1;
      }

      if (e < content.length) {
        const nextSpace = content.indexOf(' ', e);
        if (nextSpace !== -1) e = nextSpace;
      }

      return { start: s, end: e };
    };

    const buildSegment = (
            start,
            end,
            allowLeadingEllipsis = true,
            allowTrailingEllipsis = true
    ) => {
      const { start: s, end: e } = adjustWindow(start, end);
      let segment = content.slice(s, e);
      if (s > 0 && allowLeadingEllipsis) segment = '…' + segment;
      if (e < content.length && allowTrailingEllipsis) segment = segment + '…';
      return segment;
    };

    const trimToLength = (text, limit) => {
      if (text.length <= limit) return text;
      let trimmed = text.slice(0, Math.max(0, limit - 1));
      const lastSpace = trimmed.lastIndexOf(' ');
      if (lastSpace > 0 && lastSpace > trimmed.length - 20) {
        trimmed = trimmed.slice(0, lastSpace);
      }
      return trimmed.replace(/…?$/, '') + '…';
    };

    const mergeMatchesToSegments = (matches, ctx) => {
      const sorted = [...matches].sort((a, b) => a.index - b.index);
      const merged = [];

      let currentStart = sorted[0].index - ctx;
      let currentEnd = sorted[0].index + sorted[0].length + ctx;

      for (let i = 1; i < sorted.length; i++) {
        const m = sorted[i];
        const windowStart = m.index - ctx;
        const windowEnd = m.index + m.length + ctx;

        if (windowStart <= currentEnd) {
          currentEnd = Math.max(currentEnd, windowEnd);
        } else {
          merged.push(adjustWindow(currentStart, currentEnd));
          currentStart = windowStart;
          currentEnd = windowEnd;
        }
      }

      merged.push(adjustWindow(currentStart, currentEnd));
      return merged;
    };

    const estimateLength = (segments) =>
            segments.reduce((sum, seg, idx) => {
              const len = seg.end - seg.start;
              const leading = seg.start > 0 ? 1 : 0;
              const trailing = seg.end < content.length ? 1 : 0;
              const spacer = idx > 0 ? 1 : 0;
              return sum + len + leading + trailing + spacer;
            }, 0);

    const phraseMatches = collectMatches(phraseRegex);
    if (phraseMatches.length > 0) {
      const { index, length } = phraseMatches[0];
      let segment = buildSegment(index - context, index + length + context);
      if (segment.length > maxLen) {
        segment = trimToLength(segment, maxLen);
      }
      return segment;
    }

    const tokenMatches = collectMatches(tokenRegex);
    if (!tokenMatches.length) {
      return leadingSnippet();
    }

    const searchTokens = new Set(getSearchTokens(term).map((t) => t.toLowerCase()));

    let tokenContext = Math.min(
            context,
            Math.floor((maxLen / Math.max(tokenMatches.length, 1)) / 2)
    );
    tokenContext = Math.max(minContext, tokenContext);

    let segments = mergeMatchesToSegments(tokenMatches, tokenContext);
    while (segments.length > 1 && tokenContext > minContext) {
      const estimated = estimateLength(segments);
      if (estimated <= maxLen) break;

      const nextContext = Math.max(minContext, Math.floor(tokenContext * 0.75));
      if (nextContext === tokenContext) break;

      tokenContext = nextContext;
      segments = mergeMatchesToSegments(tokenMatches, tokenContext);
    }

    const segmentTokens = segments.map(() => new Set());
    tokenMatches.forEach((m) => {
      const token = m.text ? m.text.toLowerCase() : '';
      if (!searchTokens.has(token)) return;
      const segIdx = segments.findIndex((seg) => m.index >= seg.start && m.index <= seg.end);
      if (segIdx !== -1) {
        segmentTokens[segIdx].add(token);
      }
    });

    const prioritized = [];
    const extras = [];
    const covered = new Set();
    segments.forEach((seg, idx) => {
      const tokens = segmentTokens[idx];
      const hasNew = Array.from(tokens).some((t) => !covered.has(t));
      if (hasNew) {
        tokens.forEach((t) => covered.add(t));
        prioritized.push({ seg, idx });
      } else {
        extras.push({ seg, idx });
      }
    });

    const orderedSegments = [...prioritized, ...extras];

    let remaining = maxLen;
    const parts = [];

    for (let i = 0; i < orderedSegments.length && remaining > 0; i++) {
      const { seg } = orderedSegments[i];
      const separator = parts.length ? ' ' : '';
      const available = remaining - separator.length;
      if (available <= 0) break;

      let segmentText = buildSegment(seg.start, seg.end, true, true);
      if (segmentText.length > available) {
        segmentText = trimToLength(segmentText, available);
      }

      if (!segmentText) continue;

      parts.push(segmentText);
      remaining -= segmentText.length + separator.length;
    }

    return parts.length ? parts.join(' ') : leadingSnippet();
  }

</script>

<div class="database-container">
  <div class="container">
    <div class="content-wrapper">
      <section class="intro">
        <p class="lead">
          This database tracks public communications from <a href="https://hechingerreport.org/which-schools-and-colleges-are-being-investigated-by-the-trump-administration/" target="_blank">100+ universities</a> during a period of heightened federal oversight. The data contains official announcements and statements from universities starting from January 2025 and can provide instights into how institutions of higher education respond to regulatory pressure. This data is updated weekly.
          <br/><br/>
          For questions or suggestions, please email <a href="mailto:tktk@columbia.edu">tktk@columbia.edu</a>.
        </p>
      </section>

      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading database...</p>
        </div>
      {:else if error}
        <div class="error">
          <p><strong>Error loading data:</strong> {error}</p>
          <button onclick={loadInitialData} class="retry-btn">Retry</button>
        </div>
      {:else}
        <!-- Filters -->
        <section class="filters-section">
          <div class="filters-grid">

            <div class="filter-group">
              <label for="institution-dropdown">Filter by Institution</label>
              <div class="multi-select-dropdown">
                <button
                        id="institution-dropdown"
                        class={`dropdown-toggle ${institutionIndexReady ? '' : 'disabled'}`}
                        disabled={!institutionIndexReady}
                        onclick={(e) => {
                          if (!institutionIndexReady) return;
                          e.stopPropagation();
                          institutionDropdownOpen = !institutionDropdownOpen;
                          monthDropdownOpen = false;
                        }}
                        type="button"
                >
                  {#if !institutionIndexReady}
                    Loading institutions...
                  {:else if selectedInstitutions.length === 0}
                    All Institutions
                  {:else}
                    {selectedInstitutions.length} selected
                  {/if}
                  <span class="dropdown-arrow">{institutionDropdownOpen ? '▲' : '▼'}</span>
                </button>

                {#if institutionDropdownOpen}
                  <div class="dropdown-menu">
                    <div class="dropdown-search">
                      <input
                              type="text"
                              bind:value={institutionSearchTerm}
                              placeholder="Search institutions..."
                              onclick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div class="dropdown-options">
                      {#each filteredInstitutions as inst}
                        <label class="dropdown-option">
                          <input
                                  type="checkbox"
                                  value={inst}
                                  checked={selectedInstitutions.includes(inst)}
                                  onchange={(e) => toggleInstitution(inst, e.target.checked)}
                          />
                          <span>{inst}</span>
                        </label>
                      {/each}
                    </div>
                    {#if selectedInstitutions.length > 0}
                      <button class="clear-selection" onclick={clearInstitutions} type="button">
                        Clear Selection
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="filter-group">
              <label for="month-dropdown">Filter by Month</label>
              <div class="multi-select-dropdown">
                <button
                        id="month-dropdown"
                        class={`dropdown-toggle ${monthFiltersReady ? '' : 'disabled'}`}
                        disabled={!monthFiltersReady}
                        onclick={(e) => {
                          if (!monthFiltersReady) return;
                          e.stopPropagation();
                          monthDropdownOpen = !monthDropdownOpen;
                          institutionDropdownOpen = false;
                        }}
                        type="button"
                >
                  {#if !monthFiltersReady}
                    Loading months...
                  {:else if selectedMonths.length === 0}
                    All Months
                  {:else}
                    {selectedMonths.length} selected
                  {/if}
                  <span class="dropdown-arrow">{monthDropdownOpen ? '▲' : '▼'}</span>
                </button>

                {#if monthDropdownOpen}
                  <div class="dropdown-menu">
                    <div class="dropdown-search">
                      <input
                              type="text"
                              bind:value={monthSearchTerm}
                              placeholder="Search months..."
                              onclick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div class="dropdown-options">
                      {#each filteredMonths as month}
                        <label class="dropdown-option">
                          <input
                                  type="checkbox"
                                  value={month}
                                  checked={selectedMonths.includes(month)}
                                  onchange={(e) => toggleMonth(month, e.target.checked)}
                          />
                          <span>{formatMonthLabel(month)}</span>
                        </label>
                      {/each}
                      {#if noDateIds.length && showNoDateOption}
                        <label class="dropdown-option">
                          <input
                                  type="checkbox"
                                  value={NO_DATE_KEY}
                                  checked={selectedMonths.includes(NO_DATE_KEY)}
                                  onchange={(e) => toggleMonth(NO_DATE_KEY, e.target.checked)}
                          />
                          <span>No Date</span>
                        </label>
                      {/if}
                    </div>
                    {#if selectedMonths.length > 0}
                      <button class="clear-selection" onclick={clearMonths} type="button">
                        Clear Selection
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="filter-group search-export-group">
              <label for="search-input">Search and Export</label>
              <div class="search-export-row">
                <div class="search-wrapper">
                  <div class="search-input-row">
                    <input
                            id="search-input"
                            type="text"
                            bind:value={searchTerm}
                            oninput={handleSearchInput}
                            placeholder="Search title, institution, or content..."
                            class="search-input"
                    />
                    <button class="search-help" type="button" aria-label="Search tips">
                      <span class="search-help-label">i</span>
                      <div class="search-help-tooltip">
                        <p class="search-help-tooltip-text"><strong>Single or multiple words</strong>: search with one word or several words; results rank higher when more of your words appear; multi-word searches do not require the words to appear together or in order.</p>
                        <p class="search-help-tooltip-text"><strong>Exact phrase</strong>: use double quotes ("") to match exact wording, for example "campus safety"; note that it may take longer to process.</p>
                        <p class="search-help-tooltip-text"><strong>Letters only</strong>: numbers and special characters are not supported in search.</p>
                      </div>
                    </button>
                  </div>
                  <span class="quick-search-label">Example searches:</span>
                  <div class="quick-search-buttons">
                    <button type="button" class="quick-search-btn" onclick={() => quickSearch('"funding cut"')}>funding cut</button>
                    <button type="button" class="quick-search-btn" onclick={() => quickSearch('"Immigration and Customs Enforcement"')}>ICE</button>
                    <button type="button" class="quick-search-btn" onclick={() => quickSearch('"Office of Civil Rights"')}>Office of Civil Rights</button>
                    <button type="button" class="quick-search-btn" onclick={() => quickSearch('visa')}>visa</button>
                    <button type="button" class="quick-search-btn" onclick={() => quickSearch('antisemitism')}>antisemitism</button>

                  </div>
                  {#if searchError}
                    <span class="search-status error-text">Search error: {searchError}</span>
                  {/if}
                </div>
                <button
                        onclick={exportResults}
                        class="export-btn"
                        disabled={exporting || loadingArticles || activeIds.length === 0}
                >
                  {#if exporting}
                    <div class="export-progress">
                      <div class="export-progress-bar">
                        <div
                                class="export-progress-fill"
                                style={`width: ${exportPercent}%;`}
                        ></div>
                      </div>
                      <span class="export-progress-text">Exporting {exportPercent}%</span>
                    </div>
                  {:else}
                    Export {Math.max(expectedTotalCount || 0, activeIds.length).toLocaleString()} items
                  {/if}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Results -->
        <section class="results-section" bind:this={resultsSectionEl}>
          <div class="results-header">
            <h3>Results</h3>
            <p class="results-meta">
              {#if selectedMonths.length === 0 && selectedInstitutions.length === 0 && !searchTerm}
                Showing {articles.length} article(s) — page {currentPage} of {totalPages}
              {:else}
                Showing {articles.length} article(s)
                {#if selectedInstitutions.length === 1}
                  from {selectedInstitutions[0]}
                {:else if selectedInstitutions.length > 1}
                  from {selectedInstitutions.length} institutions
                {/if}
                {#if selectedMonths.length === 0}
                  across all months
                {:else if selectedMonths.length === 1}
                  {#if selectedMonths[0] === NO_DATE_KEY}
                    with no date
                  {:else}
                    in {formatMonthLabel(selectedMonths[0])}
                  {/if}
                {:else}
                  in {selectedMonths.length} month selections
                  {#if selectedMonths.includes(NO_DATE_KEY)}
                    (includes No Date)
                  {/if}
                {/if}
                {#if searchMatchDescription}
                  {searchMatchDescription}
                {/if}
                — page {currentPage} of {totalPages}
              {/if}
            </p>
          </div>

          {#if loadingArticles}
            <div class="loading">
              <div class="spinner">
                {#if searchTerm.trim()}
                  <span class="spinner-label">{searchPercent}%</span>
                {/if}
              </div>
              <p>Loading database...</p>
              {#if exactMatchActive}
                <p class="loading-note">Exact phrase searches take longer. Thanks for your patience.</p>
              {/if}
            </div>
          {:else if searchLoading}
            <div class="loading">
              <div class="spinner">
                {#if searchTerm.trim()}
                  <span class="spinner-label">{searchPercent}%</span>
                {/if}
              </div>
              <p>Loading database...</p>
              {#if exactMatchActive}
                <p class="loading-note">Exact phrase searches take longer. Thanks for your patience.</p>
              {/if}
            </div>
          {:else if !articles.length}
            <p>No articles found.</p>
          {:else}
            <div class="results-list">
              {#each articles as item}
                <article class="result-card">
                  <div class="result-header">
                    <h4 class="result-title">
                      {#if item.url}
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {@html highlight(item.title, searchTerm)}
                        </a>
                      {:else}
                        {@html highlight(item.title, searchTerm)}
                      {/if}
                    </h4>
                    {#if item.org}
                      <span class="result-school">
                        {@html highlight(item.org, searchTerm)}
                      </span>
                    {/if}
                  </div>

                  <p class="result-date">{formatDate(item.date)}</p>

                  {#if item.content}
                    <p class="result-excerpt">
                      {@html highlight(getSnippet(item.content, searchTerm), searchTerm)}
                    </p>
                  {/if}


                </article>
              {/each}
            </div>

            <div class="pagination">
              <div class="pagination-buttons">
                <button
                        class="page-btn"
                        onclick={() => changePage(1)}
                        disabled={currentPage === 1 || loadingArticles}
                >
                  First
                </button>
                <button
                        class="page-btn"
                        onclick={() => changePage(currentPage - 1)}
                        disabled={currentPage === 1 || loadingArticles}
                >
                  Previous
                </button>

                <div class="page-meta">
                  <span class="page-info">Page {currentPage} / {totalPages}</span>
                  <div class="page-jump">
                    <label class="sr-only" for="goto-page">Go to page</label>
                    <span class="page-info">Page</span>
                    <input
                            id="goto-page"
                            type="number"
                            min="1"
                            max={totalPages}
                            class="goto-input"
                            bind:value={gotoPage}
                            onchange={(e) => {
                            const target = Number(e.currentTarget.value);
                            if (!Number.isNaN(target)) changePage(target);
                          }}
                    />
                    <button
                            type="button"
                            class="page-btn"
                            onclick={() => {
                          const target = Number(gotoPage);
                          if (!Number.isNaN(target)) {
                            changePage(target);
                          }
                        }}>
                      Go
                    </button>
                  </div>
                </div>

                <button
                        class="page-btn"
                        onclick={() => changePage(currentPage + 1)}
                        disabled={currentPage === totalPages || loadingArticles}
                >
                  Next
                </button>

                <button
                        class="page-btn"
                        onclick={() => changePage(totalPages)}
                        disabled={currentPage === totalPages || loadingArticles}
                >
                  Last
                </button>
              </div>


            </div>
          {/if}
        </section>
      {/if}
    </div>

    <!-- Timeline Bar Sidebar -->
    {#if !loading && !error && months.length > 0}
      {@const monthNames = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']}
      {@const formatCount = (num) => {
        if (num >= 1000) {
          const k = num / 1000;
          return k % 1 === 0 ? k + 'K' : k.toFixed(1) + 'K';
        }
        return num.toString();
      }}
      {@const barData = months.map(key => {
        const count = manifestMonthCounts.get(key) || (monthIndex[key]?.length || 0);
        const [year, month] = key.split('-').map(Number);
        const monthName = monthNames[(month || 1) - 1];
        return { key, count, monthName, year };
      })}
      {@const maxCount = Math.max(...barData.map(d => d.count), 1)}
      <aside class="timeline-bar-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-total">{Math.max(expectedTotalCount || 0, activeIds.length).toLocaleString()}</div>
          <div class="sidebar-label">results</div>
        </div>
        <div class="sidebar-bars">
          {#each barData as bar}
            {@const barWidth = (bar.count / maxCount) * 100}
            <button
              class="sidebar-bar-row"
              class:active={selectedMonths.length === 1 && selectedMonths[0] === bar.key}
              onclick={() => handleTimelineMonthClick(bar.key)}
              type="button"
            >
              <span class="sidebar-month">{bar.monthName}</span>
              <div class="sidebar-bar-track">
                <div class="sidebar-bar-fill" style="width: {barWidth}%;"></div>
              </div>
              <span class="sidebar-count">{formatCount(bar.count)}</span>
            </button>
          {/each}
        </div>
      </aside>
    {/if}
  </div>
</div>

<style>
  .database-container {
    background: white;
    min-height: 60vh;
  }

  .container {
    max-width: none;
    width: 100%;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 0;
  }

  .content-wrapper {
    padding: 0 0 4rem;
    flex: 1;
    min-width: 0;
  }

  h2 {
    font-size: 2.5rem;
    margin: 0 0 1.5rem;
    color: #254c6f;
    font-weight: 400;
    font-family: "Lyon Display Web", serif;
    text-align: center;
  }

  .database-meta {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .meta-details {
    display: flex;
    gap: 2.5rem;
    flex-wrap: wrap;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    font-family: "Graphik Web", sans-serif;
    font-weight: 600;
  }

  .meta-value {
    font-size: 1rem;
    color: #222;
    font-family: "Lyon Text Web", serif;
  }

  .meta-value a {
    color: #254c6f;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .meta-value a:hover {
    color: #1a3547;
    text-decoration: underline;
  }

  .intro {
    margin-bottom: 3rem;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
  }

  .lead {
    font-size: 1.1rem;
    line-height: 1.7;
    color: #444;
  }

  /* Loading States */
  .loading,
  .error {
    text-align: center;
    padding: 3rem 2rem;
  }

  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #254c6f;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .spinner-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #254c6f;
    animation: spin-reverse 1s linear infinite;
  }

  .loading-note {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
    text-align: center;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-reverse {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(-360deg);
    }
  }

  .error {
    color: #dc3545;
  }

  .retry-btn {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: white;
    color: #254c6f;
    border: 2px solid #254c6f;
    cursor: pointer;
    font-size: 1rem;
    font-family: "Graphik Web", sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }
  .retry-btn:hover {
    background: #254c6f;
    color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .filters-section {
    background: #f8f8f8;
    border: 1px solid #e0e0e0;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .filters-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 0.5rem;
    align-items: start;
  }

  .search-export-group {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
  }

  .search-wrapper {
    flex: 1 1 auto;
    max-width: 100%;
    min-height: 100%;
  }

  .filter-group label {
    display: block;
    margin-top: 0.5rem;
    font-weight: 500;
    color: #222;
    font-family: "Graphik Web", sans-serif;
    font-size: 0.9rem;
  }

  .dropdown-toggle {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #dee2e6;
    font-size: 0.95rem;
    font-family: "Graphik Web", sans-serif;
    background: white;
    cursor: pointer;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: border-color 0.2s;
  }

  /* Hide Bootstrap's default dropdown arrow */
  .dropdown-toggle::after {
    display: none !important;
  }

  .dropdown-toggle:hover {
    border-color: #254c6f;
  }

  .dropdown-toggle.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .multi-select-dropdown {
    position: relative;
  }

  .dropdown-arrow {
    font-size: 0.8rem;
    color: #666;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.25rem;
    background: white;
    border: 1px solid #dee2e6;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-height: 300px;
    display: flex;
    flex-direction: column;
  }

  .dropdown-search {
    padding: 0.75rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .dropdown-search input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #dee2e6;
    font-size: 0.9rem;
    font-family: "Graphik Web", sans-serif;
  }

  .dropdown-search input:focus {
    outline: none;
    border-color: #254c6f;
  }

  .dropdown-options {
    overflow-y: auto;
    max-height: 200px;
  }

  .dropdown-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
    font-size: 0.9rem;
    font-family: "Graphik Web", sans-serif;
  }

  .dropdown-option:hover {
    background: #f8f8f8;
  }

  .dropdown-option input[type='checkbox'] {
    cursor: pointer;
    accent-color: #254c6f;
  }

  .clear-selection {
    padding: 0.5rem 0.75rem;
    margin: 0.5rem;
    border: 1px solid #dee2e6;
    background: white;
    color: #666;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: "Graphik Web", sans-serif;
    transition: all 0.2s;
  }

  .clear-selection:hover {
    background: #f8f8f8;
    border-color: #254c6f;
  }

  .search-input {
    width: 100%;
    padding: 0.8rem 1rem;
    border: 1px solid #dee2e6;
    font-size: 0.95rem;
    font-family: "Graphik Web", sans-serif;
  }
  .search-input:focus {
    outline: none;
    border-color: #254c6f;
    box-shadow: 0 0 0 3px rgba(214, 97, 58, 0.1);
  }
  .goto-input {
    padding: 0.4rem 0.4rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-family: "Graphik Web", sans-serif;
  }
  .goto-input:focus {
    outline: none;
    border-color: #254c6f;
    box-shadow: 0 0 0 3px rgba(214, 97, 58, 0.1);
  }

  .search-export-row {
    display: flex;
    gap: 1rem;
    align-items: start;
    flex-wrap: nowrap;
  }

  .search-wrapper {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    width: 100%;
  }

  .search-input-row {
    display: flex;
    align-items: start;
    gap: 0.5rem;
    width: 100%;
    min-width: 0;
  }

  .search-status {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.85rem;
    color: #666;
  }

  .search-status.error-text {
    color: #dc3545;
  }

  .quick-search-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
    flex-wrap: wrap;
  }

  .quick-search-label {
    display: block;
    font-size: 0.85rem;
    color: #666;
    margin-top: 0.75rem;
  }

  .quick-search-btn {
    background: #254c6f33;
    border: 1px solid #254c6f;
    padding: 0.25rem 0.75rem;
    font-size: 0.85rem;
    color: #43485a;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: "Graphik Web", sans-serif;
  }

  .quick-search-btn:hover {
    background: #254c6f;
    color: #fff;
    border-color: #254c6f;
  }

  .export-btn {
    background: #254c6f;
    color: #ffffff;
    border: 0;
    padding: 0.7rem 1.5rem;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: "Graphik Web", sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .export-progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }
  .export-progress-bar {
    flex: 1 1 140px;
    height: 8px;
    background: #e6eef5;
    border-radius: 999px;
    overflow: hidden;
  }
  .export-progress-fill {
    height: 100%;
    background: #d6613a;
    width: 0%;
    transition: width 0.2s ease;
  }
  .export-progress-text {
    font-size: 0.9rem;
    font-weight: 600;
    color: #254c6f;
    white-space: nowrap;
  }

  .search-help {
    position: relative;
    padding: 0.3rem 0.6rem;
    border: 1px solid #dee2e6;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    font-size: 0.85rem;
    color: #444;
    background: #f8f8f8;
    cursor: pointer;
    border: 1px solid #dee2e6;
    appearance: none;
    box-shadow: none;
    flex-shrink: 0;
    line-height: 1;
    font-family: "Graphik Web", sans-serif;
  }

  .search-help-label {
    font-weight: 600;
    font-size: 0.82rem;
    color: #444;
    white-space: nowrap;
  }

  .search-help-tooltip {
    position: absolute;
    top: 110%;
    right: 0;
    width: min(320px, 45vw);
    background: white;
    border: 1px solid #dee2e6;
    padding: 0.75rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: all 0.15s ease;
    z-index: 10;
    text-align: left;
  }

  .search-help:hover .search-help-tooltip,
  .search-help:focus-within .search-help-tooltip {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .search-help-tooltip p {
    margin: 0 0 0.35rem;
    font-size: 0.85rem;
    line-height: 1.4;
    color: #444;
  }

  .search-help-tooltip p:last-child {
    margin-bottom: 0;
  }

  .export-btn:hover:not(:disabled) {
    background: #254c6f;
    color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .export-btn:disabled {
    background: white;
    border-color: #ccc;
    color: #ccc;
    cursor: not-allowed;
    box-shadow: none;
  }

  .btn-spinner {
    border: 2px solid #254c6f;
    border-top: 2px solid transparent;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  /* Timeline Bar Sidebar */
  .timeline-bar-sidebar {
    width: 200px;
    flex-shrink: 0;
    padding: 1rem;
    background: #fafafa;
    border-left: 1px solid #e0e0e0;
    position: sticky;
    top: 0;
    height: fit-content;
    max-height: 100vh;
    overflow-y: auto;
  }

  .sidebar-header {
    text-align: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .sidebar-total {
    font-size: 1.75rem;
    font-weight: 700;
    color: #254c6f;
    font-family: "Lyon Display Web", serif;
    line-height: 1;
  }

  .sidebar-label {
    font-size: 0.8rem;
    color: #666;
    font-family: "Graphik Web", sans-serif;
    margin-top: 0.25rem;
  }

  .sidebar-bars {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .sidebar-bar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
    width: 100%;
    text-align: left;
  }

  .sidebar-bar-row:hover {
    background: #f0f0f0;
  }

  .sidebar-bar-row.active {
    background: #e8f0f8;
  }

  .sidebar-month {
    width: 32px;
    font-size: 0.75rem;
    color: #666;
    font-family: "Graphik Web", sans-serif;
    flex-shrink: 0;
  }

  .sidebar-bar-track {
    flex: 1;
    height: 12px;
    background: #e8e8e8;
    border-radius: 2px;
    overflow: hidden;
  }

  .sidebar-bar-fill {
    height: 100%;
    background: #254c6f;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .sidebar-bar-row.active .sidebar-bar-fill {
    background: #1a3a52;
  }

  .sidebar-count {
    width: 36px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #254c6f;
    font-family: "Graphik Web", sans-serif;
    text-align: right;
    flex-shrink: 0;
  }

  /* Results Section */
  .results-section {
    margin-top: 2rem;
  }

  .results-header {
    margin-bottom: 1.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #e0e0e0;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .result-card {
    background: white;
    border: 1px solid #e0e0e0;
    padding: 1.5rem;
    transition: all 0.2s ease;
  }
  .result-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-color: #254c6f;
  }
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .result-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: #222;
    margin: 0;
    font-family: "Lyon Display Web", serif;
    flex: 1;
  }
  .result-title a {
    color: #254c6f;
    text-decoration: none;
  }
  .result-title a:hover {
    text-decoration: underline;
  }
  .result-school {
    background: #f0f0f0;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-family: "Graphik Web", sans-serif;
    color: #666;
    white-space: normal;
    word-break: break-word;
    display: inline-block;
    max-width: 100%;
  }
  .result-date {
    font-size: 0.9rem;
    color: #888;
    margin: 0.5rem 0;
    font-family: "Graphik Web", sans-serif;
  }
  .result-excerpt {
    font-size: 0.95rem;
    line-height: 1.6;
    color: #555;
    margin: 1rem 0 0;
  }

  .pagination {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 3rem;
    padding: 1.5rem 0;
    align-items: center;
  }
  .page-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #dee2e6;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: "Graphik Web", sans-serif;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .page-btn:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #254c6f;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
  .pagination-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  .page-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .page-meta .page-info {
    white-space: nowrap;
  }
  .page-jump {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
  }
  .page-info {
    padding: 0 0.5rem;
    font-weight: 500;
    font-family: "Graphik Web", sans-serif;
    font-size: 0.95rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }


  @media (max-width: 768px) {
    .container {
      padding: 0 1.5rem;
      flex-direction: column;
    }

    .container :global(.timeline-sidebar) {
      display: none;
    }
    h2 {
      font-size: 2rem;
    }
    .filters-grid {
      grid-template-columns: 1fr;
    }
    .search-export-row {
      flex-wrap: wrap;
      align-items: stretch;
      flex-direction: column;
    }
    .search-wrapper {
      min-width: 0;
      width: 100%;
    }
    .export-btn {
      width: 100%;
      justify-content: center;
    }
    .pagination {
      align-items: stretch;
    }
    .page-meta {
      justify-content: center;
    }
    .page-jump {
      flex: 0 1 auto;
      justify-content: center;
    }
    .result-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .result-school {
      align-self: flex-start;
    }
  }
</style>
