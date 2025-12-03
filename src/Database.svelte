<script>
  import { onMount } from 'svelte';

  const MONTH_INDEX_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/month_index.json';
  const INSTITUTION_INDEX_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/institution_index.json';
  const ARTICLE_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/articles';
  const SEARCH_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/search_index';
  const FULL_DATA_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';

  const NO_DATE_KEY = '_no_date';
  const NO_ORG_KEY = '_no_org';

  // monthIndex: { "YYYY-MM": ["id1","id2",...], "_no_date": ["idX",...] }
  let monthIndex = {};
  // institutionIndex: { "Harvard University": ["id1","id2",...], "_no_org": [...] }
  let institutionIndex = {};

  let months = [];        // real months only, e.g. ["2025-11","2025-10",...]
  let institutions = [];  // institution names (no _no_org)

  let noDateIds = [];     // from monthIndex[NO_DATE_KEY] if present

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

  // Caching
  let initialized = false;

  // Cache of article JSONs
  const articleCache = new Map();

  // --- Search state (using search_index shards) ---
  let searchTerm = '';
  let searchLoading = false;
  let searchError = null;
  let searchTimeout;
  let exporting = false;
  // shardKey -> { token: [ids...] }
  const searchShardCache = new Map();
  let fullDatasetCache = null;

  $: filteredInstitutions = institutionSearchTerm
          ? institutions.filter((inst) =>
                  inst.toLowerCase().includes(institutionSearchTerm.toLowerCase())
          )
          : institutions;

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

  onMount(async () => {
    if (!initialized) {
      // First time visiting the tab: fetch everything
      await loadInitialData();
    } else {
      // Coming back to the tab: reuse existing data
      loading = false;          // don’t show "Loading database..." again
      error = null;
      // Optionally re-apply filters & search based on existing state:
      await applyFiltersAndSearch();
    }
  });

  async function loadInitialData() {
    // if already initialized, don’t fetch again
    if (initialized) return;

    loading = true;
    error = null;

    try {
      // load indexes in parallel
      await Promise.all([loadMonthIndex(), loadInstitutionIndex()]);

      // only set default filters on first successful load
      selectedMonths = [];
      selectedInstitutions = [];
      searchTerm = '';

      await applyFiltersAndSearch();

      initialized = true;  // mark as ready after success
    } catch (e) {
      console.error(e);
      error = e.message;
    } finally {
      loading = false;
    }
  }


  async function loadMonthIndex() {
    const res = await fetch(MONTH_INDEX_URL);
    if (!res.ok) {
      throw new Error(`Failed to load month index: ${res.status}`);
    }

    monthIndex = await res.json();

    const allKeys = Object.keys(monthIndex);

    // pull out no-date bucket
    noDateIds = Array.isArray(monthIndex[NO_DATE_KEY]) ? monthIndex[NO_DATE_KEY] : [];

    // months = all keys except NO_DATE_KEY, newest → oldest
    months = allKeys
            .filter((k) => k !== NO_DATE_KEY)
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
    if (noDateIds.length > 0) {
      globalIds.push(...noDateIds);
    }
  }

  async function loadInstitutionIndex() {
    const res = await fetch(INSTITUTION_INDEX_URL);
    if (!res.ok) {
      throw new Error(`Failed to load institution index: ${res.status}`);
    }

    institutionIndex = await res.json();

    // institutions = all keys except NO_ORG_KEY, sorted alphabetically
    institutions = Object.keys(institutionIndex)
            .filter((k) => k !== NO_ORG_KEY)
            .sort((a, b) => a.localeCompare(b));
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

  // --- Search index helpers ---

  function getShardKey(term) {
    if (!term) return null;
    const first = term[0].toLowerCase();
    if (first >= 'a' && first <= 'z') return first;
    return null; // no shard for non-letter queries
  }

  async function ensureShardLoaded(shardKey) {
    if (!shardKey) return null;

    if (searchShardCache.has(shardKey)) {
      return searchShardCache.get(shardKey);
    }

    searchLoading = true;
    searchError = null;

    try {
      const res = await fetch(`${SEARCH_INDEX_BASE_URL}/${shardKey}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load search index shard '${shardKey}': ${res.status}`);
      }
      const shard = await res.json();
      searchShardCache.set(shardKey, shard);
      return shard;
    } catch (e) {
      console.error(e);
      searchError = e.message;
      return null;
    } finally {
      searchLoading = false;
    }
  }

  // --- Core: apply filters + search, set activeIds, then page 1 ---

  // Allow multi-word search
  function getSearchTokens(raw) {
    if (!raw) return { tokens: [], phrase: null, phraseQuoted: false };

    const tokens = [];
    let phrase = null;
    let phraseQuoted = false;
    const regex = /"([^"]+)"|(\S+)/g;
    let match;
    while ((match = regex.exec(raw))) {
      if (match[1]) {
        const phraseText = match[1].trim();
        if (phraseText) {
          phraseQuoted = true;
          phrase = phraseText.toLowerCase();
          tokens.push(...phrase.split(/\s+/).filter(Boolean));
        }
      } else if (match[2]) {
        const value = match[2].trim();
        if (value) tokens.push(value.toLowerCase());
      }
    }

    if (!phrase && tokens.length > 1) {
      phrase = tokens.join(' ');
    }

    return { tokens, phrase, phraseQuoted };
  }

  // Check for a phrase (adjacent words) in title/org/content, using cached articles
  async function findPhraseMatches(ids, phrase) {
    if (!phrase) return [];
    const needle = phrase.toLowerCase();
    const matches = [];
    const articles = await Promise.all(
      ids.map(async (id) => {
        try {
          const article = await getArticleById(id);
          return { id, article };
        } catch (e) {
          console.error(e);
          return null;
        }
      })
    );

    for (const item of articles) {
      if (!item) continue;
      const { id, article } = item;
      const haystack = [article.title, article.org, article.content]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (haystack.includes(needle)) {
        matches.push(id);
      }
    }
    return matches;
  }

  async function applyFiltersAndSearch() {
    loadingArticles = true; // block stale results while computing
    articles = [];
    error = null;
    const baseIds = getBaseIdsFromFilters();
    const baseIdsSet = new Set(baseIds);
    const { tokens, phrase, phraseQuoted } = getSearchTokens(searchTerm);

    try {
      // No search term: just filtered timeline
      if (tokens.length === 0) {
        activeIds = baseIds;
        currentPage = 1;
        await loadPage(1);
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
        activeIds = [];
        currentPage = 1;
        await loadPage(1);
        return;
      }

      // load all needed shards
      const shardMap = new Map();
      for (const key of shardKeys) {
        const shard = await ensureShardLoaded(key);
        if (shard) {
          shardMap.set(key, shard);
        }
      }

      if (shardMap.size === 0) {
        activeIds = [];
        currentPage = 1;
        await loadPage(1);
        return;
      }

      // Exact token matches only (case-insensitive), intersected across tokens
      const idsPerToken = [];
      for (const term of tokens) {
        const key = getShardKey(term);
        const shard = key ? shardMap.get(key) : null;
        if (!shard) {
          idsPerToken.push(new Set());
          continue;
        }

        const exactIds = [];
        for (const [tokenRaw, ids] of Object.entries(shard)) {
          if (tokenRaw.toLowerCase() === term && Array.isArray(ids)) {
            exactIds.push(...ids);
          }
        }

        const filtered = exactIds.filter((id) => baseIdsSet.has(id));
        idsPerToken.push(new Set(filtered));
      }

      if (idsPerToken.length !== tokens.length || idsPerToken.some((s) => s.size === 0)) {
        activeIds = [];
        currentPage = 1;
        await loadPage(1);
        return;
      }

      const intersectedSet = new Set(
        baseIds.filter((id) => idsPerToken.every((set) => set.has(id)))
      );

      if (intersectedSet.size === 0) {
        activeIds = [];
        currentPage = 1;
        await loadPage(1);
        return;
      }

      let phraseIds = [];
      if (phrase) {
        const candidatesInOrder = baseIds.filter((id) => intersectedSet.has(id));
        phraseIds = await findPhraseMatches(candidatesInOrder, phrase);
      }

      if (phraseQuoted) {
        activeIds = phraseIds;
      } else {
        const phraseSet = new Set(phraseIds);
        const orderedPhraseFirst = [
          ...baseIds.filter((id) => phraseSet.has(id)),
          ...baseIds.filter((id) => intersectedSet.has(id) && !phraseSet.has(id))
        ];
        activeIds = orderedPhraseFirst;
      }
      currentPage = 1;
      await loadPage(1);
    } finally {
      loadingArticles = false;
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

  async function loadPage(page) {
    const ids = activeIds;

    if (!ids || ids.length === 0) {
      articles = [];
      currentPage = 1;
      totalPages = 1;
      gotoPage = 1;
      return;
    }

    const newTotalPages = Math.max(1, Math.ceil(ids.length / pageSize));
    if (page < 1) page = 1;
    if (page > newTotalPages) page = newTotalPages;

    currentPage = page;
    totalPages = newTotalPages;
    gotoPage = currentPage;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageIds = ids.slice(start, end);

    loadingArticles = true;
    error = null;

    try {
      const promises = pageIds.map((id) => getArticleById(id));

      articles = await Promise.all(promises);
    } catch (e) {
      console.error(e);
      error = e.message;
    } finally {
      loadingArticles = false;
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

  function handleSearchInput(event) {
    searchTerm = event.target.value;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      applyFiltersAndSearch();
    }, 1000); // debounce
  }

  const isUnfiltered = () =>
          selectedMonths.length === 0 &&
          selectedInstitutions.length === 0 &&
          !searchTerm.trim();

  async function getFullDataset() {
    if (fullDatasetCache) return fullDatasetCache;

    const res = await fetch(FULL_DATA_URL);
    if (!res.ok) {
      throw new Error(`Failed to load full dataset: ${res.status}`);
    }
    fullDatasetCache = await res.json();
    return fullDatasetCache;
  }

  function cleanDataForExport(data) {
    return data.map((item) => {
      const { llm_response, scraper, ...cleanItem } = item;
      return cleanItem;
    });
  }

  async function exportResults() {
    if (!activeIds || activeIds.length === 0) {
      alert('No data to export');
      return;
    }

    exporting = true;

    try {
      let articlesToExport;

      if (isUnfiltered()) {
        articlesToExport = await getFullDataset();
      } else {
        articlesToExport = [];
        for (const id of activeIds) {
          const article = await getArticleById(id);
          articlesToExport.push(article);
        }
      }

      const cleanData = cleanDataForExport(articlesToExport);
      await downloadCSV(cleanData);
    } catch (e) {
      console.error(e);
      alert('Error exporting data: ' + e.message);
    } finally {
      exporting = false;
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

  function changePage(newPage) {
    if (newPage < 1 || newPage > totalPages || loadingArticles) return;
    loadPage(newPage);
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

  function highlight(text, term) {
    if (!text) return '';
    if (!term || !term.trim()) return escapeHtml(text);

    const { tokens, phrase, phraseQuoted } = getSearchTokens(term);
    const patterns = [];

    if (phraseQuoted && phrase) {
      const phrasePattern = `\\b${escapeRegExp(phrase)}\\b`;
      const phraseRegex = new RegExp(phrasePattern, 'i');
      if (phraseRegex.test(text)) {
        patterns.push(phrasePattern);
      }
    } else {
      const phrasePattern = phrase ? `\\b${escapeRegExp(phrase)}\\b` : null;
      if (phrasePattern) {
        const phraseRegex = new RegExp(phrasePattern, 'i');
        if (phraseRegex.test(text)) {
          patterns.push(phrasePattern);
        }
      }
      if (patterns.length === 0) {
        for (const t of tokens) {
          patterns.push(`\\b${escapeRegExp(t)}\\b`);
        }
      }
    }

    if (patterns.length === 0) return escapeHtml(text);

    const regex = new RegExp(`(${patterns.join('|')})`, 'ig');

    const parts = text.split(regex);

    return parts
            .map((part, i) =>
                    i % 2 === 1
                            ? `<mark>${escapeHtml(part)}</mark>`
                            : escapeHtml(part)
            )
            .join('');
  }

  /**
   * Returns a snippet of `content` using exact (word-boundary) matches:
   * - if no term: first `maxLen` chars
   * - if term found: snippet centered around first whole-word/phrase occurrence
   */
  function getSnippet(content, term, maxLen = 280, context = 120) {
    if (!content) return '';

    const { tokens, phrase } = getSearchTokens(term || '');
    function leadingSnippet() {
      let text = content.slice(0, maxLen);
      const lastSpace = text.lastIndexOf(' ');
      if (lastSpace > 0 && content.length > maxLen) {
        text = text.slice(0, lastSpace);
        return text + '…';
      }
      return content.length > maxLen ? text + '…' : text;
    }

    const lowerContent = content.toLowerCase();

    // Helper to find earliest match from a list of patterns
    function findFirstMatch(patternList) {
      let found = null;
      for (const pattern of patternList) {
        const regex = new RegExp(pattern, 'i');
        const m = lowerContent.match(regex);
        if (m && m.index !== undefined) {
          if (!found || m.index < found.index) {
            found = { index: m.index, length: m[0].length };
          }
        }
      }
      return found;
    }

    const phrasePatterns = [];
    if (phrase) {
      phrasePatterns.push(`\\b${escapeRegExp(phrase)}\\b`);
    }

    const tokenPatterns = tokens.map((t) => `\\b${escapeRegExp(t)}\\b`);

    // Prefer phrase match if present; otherwise fall back to token match
    const phraseMatch = phrasePatterns.length ? findFirstMatch(phrasePatterns) : null;
    const tokenMatch = !phraseMatch && tokenPatterns.length ? findFirstMatch(tokenPatterns) : null;
    const match = phraseMatch || tokenMatch;

    if (!match) {
      return leadingSnippet();
    }

    const matchIndex = match.index;
    const matchLength = match.length;

    // raw window around the match
    let rawStart = Math.max(0, matchIndex - context);
    let rawEnd = Math.min(content.length, matchIndex + matchLength + context);

    // Adjust start to the previous space (word boundary)
    if (rawStart > 0) {
      const prevSpace = content.lastIndexOf(' ', rawStart);
      if (prevSpace !== -1) {
        rawStart = prevSpace + 1;
      }
    }

    // Adjust end to the next space (word boundary)
    if (rawEnd < content.length) {
      const nextSpace = content.indexOf(' ', rawEnd);
      if (nextSpace !== -1) {
        rawEnd = nextSpace;
      }
    }

    // Ensure snippet length doesn't exceed maxLen too much
    if (rawEnd - rawStart > maxLen) {
      rawEnd = rawStart + maxLen;
      const lastSpace = content.lastIndexOf(' ', rawEnd);
      if (lastSpace > rawStart) {
        rawEnd = lastSpace;
      }
    }

    let snippet = content.slice(rawStart, rawEnd);

    if (rawStart > 0) snippet = '…' + snippet;
    if (rawEnd < content.length) snippet = snippet + '…';

    return snippet;
  }

</script>

<div class="database-container">
  <div class="container">
    <div class="content-wrapper">
      <h2>Database Search</h2>

      <section class="intro">
        <p class="lead">
          Search and filter through all institutional responses. Use the filters below to narrow results by institution,
          date, or keyword, then download your filtered results.
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
          <button on:click={loadInitialData} class="retry-btn">Retry</button>
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
                        class="dropdown-toggle"
                        on:click|stopPropagation={() => {
                          institutionDropdownOpen = !institutionDropdownOpen;
                          monthDropdownOpen = false;
                        }}
                        type="button"
                >
                  {selectedInstitutions.length === 0
                          ? 'All Institutions'
                          : `${selectedInstitutions.length} selected`}
                  <span class="dropdown-arrow">{institutionDropdownOpen ? '▲' : '▼'}</span>
                </button>

                {#if institutionDropdownOpen}
                  <div class="dropdown-menu">
                    <div class="dropdown-search">
                      <input
                              type="text"
                              bind:value={institutionSearchTerm}
                              placeholder="Search institutions..."
                              on:click|stopPropagation
                      />
                    </div>
                    <div class="dropdown-options">
                      {#each filteredInstitutions as inst}
                        <label class="dropdown-option">
                          <input
                                  type="checkbox"
                                  value={inst}
                                  checked={selectedInstitutions.includes(inst)}
                                  on:change={(e) => toggleInstitution(inst, e.target.checked)}
                          />
                          <span>{inst}</span>
                        </label>
                      {/each}
                    </div>
                    {#if selectedInstitutions.length > 0}
                      <button class="clear-selection" on:click={clearInstitutions} type="button">
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
                        class="dropdown-toggle"
                        on:click|stopPropagation={() => {
                          monthDropdownOpen = !monthDropdownOpen;
                          institutionDropdownOpen = false;
                        }}
                        type="button"
                >
                  {selectedMonths.length === 0
                          ? 'All Months'
                          : `${selectedMonths.length} selected`}
                  <span class="dropdown-arrow">{monthDropdownOpen ? '▲' : '▼'}</span>
                </button>

                {#if monthDropdownOpen}
                  <div class="dropdown-menu">
                    <div class="dropdown-search">
                      <input
                              type="text"
                              bind:value={monthSearchTerm}
                              placeholder="Search months..."
                              on:click|stopPropagation
                      />
                    </div>
                    <div class="dropdown-options">
                      {#each filteredMonths as month}
                        <label class="dropdown-option">
                          <input
                                  type="checkbox"
                                  value={month}
                                  checked={selectedMonths.includes(month)}
                                  on:change={(e) => toggleMonth(month, e.target.checked)}
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
                                  on:change={(e) => toggleMonth(NO_DATE_KEY, e.target.checked)}
                          />
                          <span>No Date</span>
                        </label>
                      {/if}
                    </div>
                    {#if selectedMonths.length > 0}
                      <button class="clear-selection" on:click={clearMonths} type="button">
                        Clear Selection
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <div class="search-export-row">
            <div class="search-wrapper">
              <div class="search-input-row">
                <input
                        id="search-input"
                        type="text"
                        bind:value={searchTerm}
                        on:input={handleSearchInput}
                        placeholder="Search title, institution, or content..."
                        class="search-input"
                />
                <div class="search-help" tabindex="0" aria-label="Search tips">
                  <span class="search-help-label">i</span>
                  <div class="search-help-tooltip">
                    <p><strong>Single or multiple words</strong>: search with one word or a short phrase.</p>
                    <p><strong>Double quotation mark</strong>: match the exact word or phrase, for example "campus" or "campus safety".</p>
                    <p><strong>Numbers / special chars</strong>: cannot be used in the search text.</p>
                  </div>
                </div>
              </div>
              {#if searchError}
                <span class="search-status error-text">Search error: {searchError}</span>
              {/if}
            </div>
            <button
                    on:click={exportResults}
                    class="export-btn"
                    disabled={exporting || loadingArticles || activeIds.length === 0}
            >
              {#if exporting}
                <span class="btn-spinner"></span>
                Exporting...
              {:else}
                Export {activeIds.length.toLocaleString()} items to CSV
              {/if}
            </button>
          </div>
        </section>

        <!-- Results -->
        <section class="results-section">
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
                {#if searchTerm}
                  matching “{searchTerm}”
                {/if}
                — page {currentPage} of {totalPages}
              {/if}
            </p>
          </div>

          {#if loadingArticles}
            <div class="loading">
              <div class="spinner"></div>
              <p>Loading database...</p>
            </div>
          {:else if searchLoading}
            <div class="loading">
              <div class="spinner"></div>
              <p>Loading database...</p>
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
                        {@html highlight(getSnippet(item.org, searchTerm), searchTerm)}
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
              <button
                      class="page-btn"
                      on:click={() => changePage(1)}
                      disabled={currentPage === 1 || loadingArticles}
              >
                First
              </button>
              <button
                      class="page-btn"
                      on:click={() => changePage(currentPage - 1)}
                      disabled={currentPage === 1 || loadingArticles}
              >
                Previous
              </button>

              <span class="page-info">
                Page {currentPage} of {totalPages}
              </span>

              <!-- Jump to page -->
              <label class="page-info">
                Page
                <input
                        type="number"
                        min="1"
                        max={totalPages}
                        class="goto-input"
                        bind:value={gotoPage}
                        on:change={(e) => {
                          const target = Number(e.currentTarget.value);
                          if (!Number.isNaN(target)) changePage(target);
                        }}
                />


              <button
                      type="button"
                      class="page-btn"
                      on:click={() => {
                      const target = Number(gotoPage);
                      if (!Number.isNaN(target)) {
                        changePage(target);
                      }
                    }}>
                                Go
              </button>
              </label>

              <button
                      class="page-btn"
                      on:click={() => changePage(currentPage + 1)}
                      disabled={currentPage === totalPages || loadingArticles}
              >
                Next
              </button>

              <button
                      class="page-btn"
                      on:click={() => changePage(totalPages)}
                      disabled={currentPage === totalPages || loadingArticles}
              >
                Last
              </button>
            </div>
          {/if}
        </section>
      {/if}
    </div>
  </div>
</div>

<style>
  .database-container {
    background: white;
    min-height: 60vh;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 3rem;
  }

  .content-wrapper {
    padding: 2rem 0 4rem;
  }

  h2 {
    font-size: 2.5rem;
    margin: 0 0 1.5rem;
    color: #d6613a;
    font-weight: 400;
    font-family: 'EB Garamond', serif;
    text-align: center;
  }

  .intro {
    text-align: center;
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
    border-top: 4px solid #d6613a;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .error {
    color: #dc3545;
  }

  .retry-btn {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: white;
    color: #d6613a;
    border: 2px solid #d6613a;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-family: 'Helvetica Neue', sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }
  .retry-btn:hover {
    background: #d6613a;
    color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .filters-section {
    background: #f8f8f8;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .filter-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #222;
    font-family: 'Helvetica Neue', sans-serif;
    font-size: 0.9rem;
  }

  .dropdown-toggle {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-size: 0.95rem;
    font-family: 'Helvetica Neue', sans-serif;
    background: white;
    cursor: pointer;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: border-color 0.2s;
  }
  .dropdown-toggle:hover {
    border-color: #d6613a;
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
    border-radius: 4px;
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
    border-radius: 4px;
    font-size: 0.9rem;
    font-family: 'Helvetica Neue', sans-serif;
  }

  .dropdown-search input:focus {
    outline: none;
    border-color: #d6613a;
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
    font-family: 'Helvetica Neue', sans-serif;
  }

  .dropdown-option:hover {
    background: #f8f8f8;
  }

  .dropdown-option input[type='checkbox'] {
    cursor: pointer;
    accent-color: #d6613a;
  }

  .clear-selection {
    padding: 0.5rem 0.75rem;
    margin: 0.5rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background: white;
    color: #666;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: 'Helvetica Neue', sans-serif;
    transition: all 0.2s;
  }

  .clear-selection:hover {
    background: #f8f8f8;
    border-color: #d6613a;
  }

  .search-input {
    width: 100%;
    padding: 0.8rem 1rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-size: 0.95rem;
    font-family: 'Helvetica Neue', sans-serif;
  }
  .search-input:focus {
    outline: none;
    border-color: #d6613a;
    box-shadow: 0 0 0 3px rgba(214, 97, 58, 0.1);
  }
  .goto-input {
    padding: 0.4rem 0.4rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-family: 'Helvetica Neue', sans-serif;
  }
  .goto-input:focus {
    outline: none;
    border-color: #d6613a;
    box-shadow: 0 0 0 3px rgba(214, 97, 58, 0.1);
  }

  .search-export-row {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-wrapper {
    flex: 1;
    min-width: 250px;
  }

  .search-input-row {
    display: flex;
    align-items: start;
    gap: 0.5rem;
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

  .export-btn {
    background: white;
    color: #d6613a;
    border: 2px solid #d6613a;
    border-radius: 4px;
    padding: 0.7rem 1.5rem;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Helvetica Neue', sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
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
    flex-shrink: 0;
    line-height: 1;
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
    width: 260px;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 0.75rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: all 0.15s ease;
    z-index: 10;
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
    background: #d6613a;
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
    border: 2px solid #d6613a;
    border-top: 2px solid transparent;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
    display: inline-block;
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
    border-radius: 6px;
    padding: 1.5rem;
    transition: all 0.2s ease;
  }
  .result-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-color: #d6613a;
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
    font-family: 'EB Garamond', serif;
    flex: 1;
  }
  .result-title a {
    color: #d6613a;
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
    font-family: 'Helvetica Neue', sans-serif;
    color: #666;
    white-space: nowrap;
  }
  .result-date {
    font-size: 0.9rem;
    color: #888;
    margin: 0.5rem 0;
    font-family: 'Helvetica Neue', sans-serif;
  }
  .result-excerpt {
    font-size: 0.95rem;
    line-height: 1.6;
    color: #555;
    margin: 1rem 0 0;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-top: 3rem;
    padding: 1.5rem 0;
  }
  .page-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #dee2e6;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: 'Helvetica Neue', sans-serif;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .page-btn:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #d6613a;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
  .page-info {
    padding: 0 1rem;
    font-weight: 500;
    font-family: 'Helvetica Neue', sans-serif;
    font-size: 0.95rem;
  }


  @media (max-width: 768px) {
    .container {
      padding: 0 1.5rem;
    }
    h2 {
      font-size: 2rem;
    }
    .filters-grid {
      grid-template-columns: 1fr;
    }
    .search-export-row {
      flex-direction: column;
      align-items: stretch;
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
