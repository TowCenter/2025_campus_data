<script>
  import { onMount } from 'svelte';

  const MONTH_INDEX_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/month_index.json';
  const INSTITUTION_INDEX_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/institution_index.json';
  const ARTICLE_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/articles';
  const SEARCH_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/search_index';

  const NO_DATE_KEY = '_no_date';
  const NO_ORG_KEY = '_no_org';

  // monthIndex: { "YYYY-MM": ["id1","id2",...], "_no_date": ["idX",...] }
  let monthIndex = {};
  // institutionIndex: { "Harvard University": ["id1","id2",...], "_no_org": [...] }
  let institutionIndex = {};

  let months = [];        // real months only, e.g. ["2025-11","2025-10",...]
  let institutions = [];  // institution names (no _no_org)

  let noDateIds = [];     // from monthIndex[NO_DATE_KEY] if present

  // Filters
  let selectedMonth = 'ALL';        // "ALL", "YYYY-MM", or NO_DATE_KEY
  let selectedInstitution = 'ALL';  // "ALL" or actual org name

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
  // shardKey -> { token: [ids...] }
  const searchShardCache = new Map();

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
      selectedMonth = 'ALL';
      selectedInstitution = 'ALL';
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
    // 1) Month
    let baseIds;
    if (selectedMonth === 'ALL') {
      baseIds = globalIds;
    } else if (selectedMonth === NO_DATE_KEY) {
      baseIds = noDateIds;
    } else {
      const ids = monthIndex[selectedMonth];
      baseIds = Array.isArray(ids) ? ids : [];
    }

    // 2) Institution
    if (selectedInstitution === 'ALL') {
      return baseIds;
    }

    const instIds = institutionIndex[selectedInstitution];
    if (!Array.isArray(instIds) || instIds.length === 0) {
      return [];
    }

    const instSet = new Set(instIds);
    return baseIds.filter((id) => instSet.has(id));
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
    return raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  async function applyFiltersAndSearch() {
    const baseIds = getBaseIdsFromFilters();
    const tokens = getSearchTokens(searchTerm);

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

    // scoreMap: id -> score
    const scoreMap = new Map();

    for (const term of tokens) {
      const key = getShardKey(term);
      if (!key) continue;

      const shard = shardMap.get(key);
      if (!shard) continue;

      for (const [tokenRaw, ids] of Object.entries(shard)) {
        const token = tokenRaw.toLowerCase();

        let weight = 0;
        if (token === term) {
          weight = 100;           // exact word
        } else if (token.startsWith(term)) {
          weight = 10;           // prefix
        } else if (token.includes(term)) {
          weight = 1;           // looser contains
        }

        if (!weight) continue;

        for (const id of ids) {
          const prev = scoreMap.get(id) || 0;
          scoreMap.set(id, prev + weight);
        }
      }
    }

    // Score-based ordering, but still respecting baseIds (date) within each score
    const buckets = new Map(); // score -> [ids in baseIds order]

    for (const id of baseIds) {
      const score = scoreMap.get(id);
      if (!score) continue; // id doesn't match any word
      if (!buckets.has(score)) buckets.set(score, []);
      buckets.get(score).push(id);
    }

    if (buckets.size === 0) {
      activeIds = [];
      currentPage = 1;
      await loadPage(1);
      return;
    }

    const sortedScores = [...buckets.keys()].sort((a, b) => b - a);
    const filteredBySearch = [];
    for (const score of sortedScores) {
      filteredBySearch.push(...buckets.get(score));
    }

    activeIds = filteredBySearch;
    currentPage = 1;
    await loadPage(1);
  }

    // --- Paging + article loading ---

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
      const promises = pageIds.map(async (id) => {
        if (articleCache.has(id)) return articleCache.get(id);

        const res = await fetch(`${ARTICLE_BASE_URL}/${id}.json`);
        if (!res.ok) {
          throw new Error(`Failed to load article ${id}: ${res.status}`);
        }

        const data = await res.json();
        articleCache.set(id, data);
        return data;
      });

      articles = await Promise.all(promises);
    } catch (e) {
      console.error(e);
      error = e.message;
    } finally {
      loadingArticles = false;
    }
  }

  async function handleMonthChange(event) {
    selectedMonth = event.target.value;
    currentPage = 1;
    await applyFiltersAndSearch();
  }

  async function handleInstitutionChange(event) {
    selectedInstitution = event.target.value;
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
    }, 300); // debounce
  }

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

    const tokens = term.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return escapeHtml(text);

    const pattern = tokens.map(escapeRegExp).join('|');
    const regex = new RegExp(`(${pattern})`, 'ig');

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
   * Returns a snippet of `content`:
   * - if no term: first `maxLen` chars
   * - if term found: snippet centered around first occurrence, with some context
   */
  function getSnippet(content, term, maxLen = 250, context = 20) {
    if (!content) return '';

    const trimmed = term ? term.trim() : '';
    const firstWord = trimmed.split(/\s+/).filter(Boolean)[0];

    // No usable search word: just take the leading snippet, word-safe
    if (!firstWord) {
      let text = content.slice(0, maxLen);
      const lastSpace = text.lastIndexOf(' ');
      if (lastSpace > 0 && content.length > maxLen) {
        text = text.slice(0, lastSpace);
        return text + '…';
      }
      return content.length > maxLen ? text + '…' : text;
    }

    const lowerContent = content.toLowerCase();
    const lowerTerm = firstWord.toLowerCase();

    const matchIndex = lowerContent.indexOf(lowerTerm);

    // Term not found: fallback to start
    if (matchIndex === -1) {
      let text = content.slice(0, maxLen);
      const lastSpace = text.lastIndexOf(' ');
      if (lastSpace > 0 && content.length > maxLen) {
        text = text.slice(0, lastSpace);
        return text + '…';
      }
      return content.length > maxLen ? text + '…' : text;
    }

    // raw window around the match
    let rawStart = Math.max(0, matchIndex - context);
    let rawEnd = Math.min(content.length, matchIndex + lowerTerm.length + context);

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
            <!-- Month filter -->
            <div class="filter-group">
              <label for="month-select">Filter by Month</label>
              <select
                      id="month-select"
                      class="dropdown-toggle"
                      bind:value={selectedMonth}
                      on:change={handleMonthChange}
              >
                <option value="ALL">All Months</option>
                {#each months as month}
                  <option value={month}>{formatMonthLabel(month)}</option>
                {/each}
                {#if noDateIds.length}
                  <option value={NO_DATE_KEY}>No Date</option>
                {/if}
              </select>
            </div>

            <!-- Institution filter -->
            <div class="filter-group">
              <label for="institution-select">Filter by Institution</label>
              <select
                      id="institution-select"
                      class="dropdown-toggle"
                      bind:value={selectedInstitution}
                      on:change={handleInstitutionChange}
              >
                <option value="ALL">All Institutions</option>
                {#each institutions as inst}
                  <option value={inst}>{inst}</option>
                {/each}
              </select>
            </div>

            <!-- Search filter -->
            <div class="filter-group">
              <label for="search-input">Search</label>
              <input
                      id="search-input"
                      class="search-input"
                      type="text"
                      placeholder="Search title, institution, or content..."
                      value={searchTerm}
                      on:input={handleSearchInput}
              />
              {#if searchLoading}
                <span class="search-status">Loading search index…</span>
              {/if}
              {#if searchError}
                <span class="search-status error-text">Search error: {searchError}</span>
              {/if}
            </div>
          </div>
        </section>

        <!-- Results -->
        <section class="results-section">
          <div class="results-header">
            <h3>Results</h3>
            <p class="results-meta">
              {#if selectedMonth === 'ALL' && selectedInstitution === 'ALL' && !searchTerm}
                Showing {articles.length} article(s) — page {currentPage} of {totalPages}
              {:else}
                Showing {articles.length} article(s)
                {#if selectedInstitution !== 'ALL'}
                  from {selectedInstitution}
                {/if}
                {#if selectedMonth === 'ALL'}
                  across all months
                {:else if selectedMonth === NO_DATE_KEY}
                  with no date
                {:else}
                  in {formatMonthLabel(selectedMonth)}
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
              <p>Loading articles...</p>
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
                          {@html highlight(getSnippet(item.title, searchTerm), searchTerm)}
                        </a>
                      {:else}
                        {@html highlight(getSnippet(item.title, searchTerm), searchTerm)}
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
    .result-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .result-school {
      align-self: flex-start;
    }
  }
</style>