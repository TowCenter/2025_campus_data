<script>
  import { onMount } from 'svelte';

  // Point these to your new S3 layout
  const MONTH_INDEX_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/month_index.json';
  const ARTICLE_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/articles';
  const NO_DATE_KEY = '_no_date';


  // monthIndex: { "YYYY-MM": ["id1","id2",...], ... }
  let monthIndex = {};

  // Sorted month keys, newest → oldest, e.g. ["2025-11", "2025-10", ...]
  let months = [];

  // Added a place to store no-date IDs:
  let noDateIds = [];

  // "ALL" means global across all months
  let selectedMonth = 'ALL';

  // Global ordered list of all article IDs across months, newest → oldest
  let globalIds = [];

  // Articles for *current* page only
  let articles = [];

  // Loading + error
  let loading = true;           // initial load (index + first page)
  let loadingArticles = false;  // per-page article fetch
  let error = null;

  // Pagination
  let currentPage = 1;
  const pageSize = 50;
  let totalPages = 1;

  // Cache article JSON so we don't refetch them
  const articleCache = new Map();

  onMount(async () => {
    await loadInitialData();
  });

  async function loadInitialData() {
    loading = true;
    error = null;

    try {
      await loadMonthIndex();

      // Start with the full global timeline
      selectedMonth = 'ALL';
      await loadPage(1);
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

    // pull out no-date bucket if present
    noDateIds = Array.isArray(monthIndex[NO_DATE_KEY]) ? monthIndex[NO_DATE_KEY] : [];

    // months = all keys except NO_DATE_KEY, sorted newest → oldest
    months = allKeys
            .filter((k) => k !== NO_DATE_KEY)
            .sort()
            .reverse();

    // Build globalIds: all dated months (newest → oldest), then no-date
    globalIds = [];
    for (const month of months) {
      const ids = monthIndex[month];
      if (Array.isArray(ids)) {
        globalIds.push(...ids);
      }
    }
    // append no-date IDs last
    if (noDateIds.length > 0) {
      globalIds.push(...noDateIds);
    }
  }

  function getActiveIdList() {
    if (selectedMonth === 'ALL') {
      return globalIds;
    }
    if (selectedMonth === NO_DATE_KEY) {
      return noDateIds;
    }
    const ids = monthIndex[selectedMonth];
    return Array.isArray(ids) ? ids : [];
  }


  async function loadPage(page) {
    const ids = getActiveIdList();

    if (ids.length === 0) {
      articles = [];
      currentPage = 1;
      totalPages = 1;
      return;
    }

    const newTotalPages = Math.max(1, Math.ceil(ids.length / pageSize));
    if (page < 1) page = 1;
    if (page > newTotalPages) page = newTotalPages;

    currentPage = page;
    totalPages = newTotalPages;

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
    await loadPage(1);
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
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }


  function formatDate(dateStr) {
    if (!dateStr) return 'Date unknown';
    const d = new Date(dateStr);
    if (!isFinite(d)) return 'Date unknown';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

</script>

<div class="database-container">
  <div class="container">
    <div class="content-wrapper">
      <h2>Database Search</h2>

      <section class="intro">
        <p class="lead">
          Browse institutional responses in reverse chronological order. The newest articles are
          loaded first; older ones are fetched lazily when you browse further pages.
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
        <!-- Month filter (with "All Months" option) -->
        <section class="filters-section">
          <div class="filters-grid">
            <div class="filter-group">
              <label for="month-select">Filter by Month</label>
              <select
                      id="month-select"
                      class="month-select"
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
          </div>
        </section>

        <!-- Results -->
        <section class="results-section">
          <div class="results-header">
            <h3>Results</h3>
            <p class="results-meta">
              {#if selectedMonth === 'ALL'}
                Showing {articles.length} article(s) from all months —
                page {currentPage} of {totalPages}
              {:else}
                Showing {articles.length} article(s) from {formatMonthLabel(selectedMonth)} —
                page {currentPage} of {totalPages}
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
                          {item.title}
                        </a>
                      {:else}
                        {item.title}
                      {/if}
                    </h4>

                    {#if item.org}
                      <span class="result-school">{item.org}</span>
                    {/if}
                  </div>

                  {#if item.date}
                    <p class="result-date">{formatDate(item.date)}</p>
                  {/if}

                  {#if item.content}
                    <p class="result-excerpt">
                      {item.content.substring(0, 250)}
                      {item.content.length > 250 ? '...' : ''}
                    </p>
                  {/if}
                </article>
              {/each}
            </div>

            <div class="pagination">
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
              <label class="page-jump">
                Go to
                <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={currentPage}
                        on:change={(e) => {
        const target = Number(e.currentTarget.value);
        if (!Number.isNaN(target)) changePage(target);
      }}
                />
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
    color: #D6613A;
    font-weight: 400;
    font-family: "EB Garamond", serif;
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

  .loading, .error {
    text-align: center;
    padding: 3rem 2rem;
  }

  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #D6613A;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error { color: #dc3545; }

  .retry-btn {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: white;
    color: #D6613A;
    border: 2px solid #D6613A;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-family: "Helvetica Neue", sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }
  .retry-btn:hover {
    background: #D6613A; color: white; box-shadow: 0 4px 8px rgba(0,0,0,0.15); transform: translateY(-1px);
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
    font-family: "Helvetica Neue", sans-serif;
    font-size: 0.9rem;
  }

  .multi-select-dropdown { position: relative; }

  .dropdown-toggle {
    width: 100%; padding: 0.75rem; border: 1px solid #dee2e6; border-radius: 4px; font-size: 0.95rem;
    font-family: "Helvetica Neue", sans-serif; background: white; cursor: pointer; text-align: left;
    display: flex; justify-content: space-between; align-items: center; transition: border-color 0.2s;
  }
  .dropdown-toggle:hover { border-color: #D6613A; }
  .dropdown-arrow { font-size: 0.8rem; color: #666; }

  .dropdown-menu {
    position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.25rem; background: white; border: 1px solid #dee2e6;
    border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; max-height: 300px; display: flex; flex-direction: column;
  }
  .dropdown-search { padding: 0.75rem; border-bottom: 1px solid #e0e0e0; }
  .dropdown-search input { width: 100%; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px; font-size: 0.9rem; font-family: "Helvetica Neue", sans-serif; }
  .dropdown-search input:focus { outline: none; border-color: #D6613A; }
  .dropdown-options { overflow-y: auto; max-height: 200px; }
  .dropdown-option { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; cursor: pointer; transition: background 0.15s; font-size: 0.9rem; font-family: "Helvetica Neue", sans-serif; }
  .dropdown-option:hover { background: #f8f8f8; }
  .dropdown-option input[type="checkbox"] { cursor: pointer; accent-color: #D6613A; }
  .clear-selection { padding: 0.5rem 0.75rem; margin: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px; background: white; color: #666; font-size: 0.85rem; cursor: pointer; font-family: "Helvetica Neue", sans-serif; transition: all 0.2s; }
  .clear-selection:hover { background: #f8f8f8; border-color: #D6613A; }

  .search-export-row { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
  .search-wrapper { flex: 1; min-width: 250px; position: relative; }
  .search-loader { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; color: #888; font-family: "Helvetica Neue", sans-serif; }
  .search-input { width: 100%; padding: 0.75rem 1rem; border: 1px solid #dee2e6; border-radius: 4px; font-size: 0.95rem; font-family: "Helvetica Neue", sans-serif; }
  .search-input:focus { outline: none; border-color: #D6613A; box-shadow: 0 0 0 3px rgba(214,97,58,0.1); }

  .export-btn {
    background: white; color: #D6613A; border: 2px solid #D6613A; border-radius: 4px; padding: 0.7rem 1.5rem; font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease; font-family: "Helvetica Neue", sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: nowrap; display: inline-flex; align-items: center; gap: 0.5rem;
  }
  .export-btn:hover:not(:disabled) { background: #D6613A; color: white; box-shadow: 0 4px 8px rgba(0,0,0,0.15); transform: translateY(-1px); }
  .export-btn:disabled { background: white; border-color: #ccc; color: #ccc; cursor: not-allowed; box-shadow: none; }
  .btn-spinner { border: 2px solid #D6613A; border-top: 2px solid transparent; border-radius: 50%; width: 16px; height: 16px; animation: spin 0.8s linear infinite; display: inline-block; }

  .results-section { margin-top: 2rem; }
  .results-header { margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 2px solid #e0e0e0; }
  .results-count { font-family: "Helvetica Neue", sans-serif; font-weight: 500; color: #666; font-size: 0.95rem; }
  .filter-indicator { color: #888; font-weight: 400; }

  .results-list { display: flex; flex-direction: column; gap: 1.5rem; }
  .result-card { background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 1.5rem; transition: all 0.2s ease; }
  .result-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-color: #D6613A; }
  .result-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; }
  .result-title { font-size: 1.25rem; font-weight: 500; color: #222; margin: 0; font-family: "EB Garamond", serif; flex: 1; }
  .result-title a { color: #D6613A; text-decoration: none; }
  .result-title a:hover { text-decoration: underline; }
  .result-school { background: #f0f0f0; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem; font-family: "Helvetica Neue", sans-serif; color: #666; white-space: nowrap; }
  .result-date { font-size: 0.9rem; color: #888; margin: 0.5rem 0; font-family: "Helvetica Neue", sans-serif; }
  .result-excerpt { font-size: 0.95rem; line-height: 1.6; color: #555; margin: 1rem 0 0; }

  .pagination { display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 3rem; padding: 1.5rem 0; }
  .page-btn { padding: 0.5rem 1rem; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-family: "Helvetica Neue", sans-serif; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .page-btn:hover:not(:disabled) { background: #f8f9fa; border-color: #D6613A; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transform: translateY(-1px); }
  .page-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
  .page-info { padding: 0 1rem; font-weight: 500; font-family: "Helvetica Neue", sans-serif; font-size: 0.95rem; }

  @media (max-width: 768px) {
    .container { padding: 0 1.5rem; }
    h2 { font-size: 2rem; }
    .filters-grid { grid-template-columns: 1fr; }
    .search-export-row { flex-direction: column; align-items: stretch; }
    .export-btn { width: 100%; justify-content: center; }
    .result-header { flex-direction: column; align-items: flex-start; }
    .result-school { align-self: flex-start; }
  }
</style>
