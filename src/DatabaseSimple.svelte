<script>
  import { onMount } from 'svelte';

  // Data URLs
  const MONTH_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/month_index';
  const MONTH_INDEX_MANIFEST_URL = `${MONTH_INDEX_BASE_URL}/manifest.json`;
  const INSTITUTION_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/institution_index';
  const INSTITUTION_INDEX_MANIFEST_URL = `${INSTITUTION_INDEX_BASE_URL}/manifest.json`;
  const ARTICLE_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/articles';
  const SEARCH_TERM_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/search_term';
  const FULL_DATA_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';

  // Search state
  let searchPhrases = [''];
  let excludePhrases = [''];
  let dateFrom = '2025-01-01';
  let dateTo = new Date().toISOString().split('T')[0];

  // Results state
  let hasSearched = false;
  let searching = false;
  let searchError = null;
  let results = [];
  let totalCount = 0;
  let timelineData = [];
  let institutions = [];
  let selectedInstitution = '';

  // Data caches
  let monthIndex = {};
  let institutionIndex = {};
  let monthManifest = null;
  let institutionManifest = null;
  let fullDatasetCache = null;
  const articleCache = new Map();
  const searchTokenCache = new Map();

  // Derived
  $: sampleResults = results.slice(0, 10);
  $: totalInDataset = Object.values(monthManifest || {}).reduce((sum, yearData) => {
    return sum + Object.values(yearData).reduce((s, count) => s + count, 0);
  }, 0);
  $: matchPercentage = totalInDataset > 0 ? ((totalCount / totalInDataset) * 100).toFixed(2) : 0;

  function addSearchPhrase() {
    searchPhrases = [...searchPhrases, ''];
  }

  function removeSearchPhrase(index) {
    if (searchPhrases.length > 1) {
      searchPhrases = searchPhrases.filter((_, i) => i !== index);
    }
  }

  function addExcludePhrase() {
    excludePhrases = [...excludePhrases, ''];
  }

  function removeExcludePhrase(index) {
    if (excludePhrases.length > 1) {
      excludePhrases = excludePhrases.filter((_, i) => i !== index);
    }
  }

  function setLastMonth() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    dateFrom = lastMonth.toISOString().split('T')[0];
    dateTo = now.toISOString().split('T')[0];
  }

  function setLast3Months() {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    dateFrom = threeMonthsAgo.toISOString().split('T')[0];
    dateTo = now.toISOString().split('T')[0];
  }

  function getQueryPreview() {
    const phrases = searchPhrases.filter(p => p.trim());
    const excludes = excludePhrases.filter(p => p.trim());

    if (phrases.length === 0) return '';

    let query = phrases.map(p => `"${p}"`).join(' OR ');
    if (excludes.length > 0) {
      query += ' AND NOT (' + excludes.map(p => `"${p}"`).join(' OR ') + ')';
    }
    return query;
  }

  $: queryPreview = getQueryPreview();

  async function loadManifests() {
    try {
      const [monthRes, instRes] = await Promise.all([
        fetch(MONTH_INDEX_MANIFEST_URL),
        fetch(INSTITUTION_INDEX_MANIFEST_URL)
      ]);

      if (monthRes.ok) {
        monthManifest = await monthRes.json();
      }

      if (instRes.ok) {
        institutionManifest = await instRes.json();
        institutions = Object.keys(institutionManifest).sort();
      }
    } catch (e) {
      console.error('Failed to load manifests:', e);
    }
  }

  async function loadFullDataset() {
    if (fullDatasetCache) return fullDatasetCache;

    const res = await fetch(FULL_DATA_URL);
    if (!res.ok) throw new Error('Failed to load dataset');
    fullDatasetCache = await res.json();
    return fullDatasetCache;
  }

  function getSearchTokens(phrase) {
    return phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  async function ensureTokenLoaded(token) {
    if (searchTokenCache.has(token)) {
      return searchTokenCache.get(token);
    }

    try {
      const safeToken = encodeURIComponent(token);
      const res = await fetch(`${SEARCH_TERM_BASE_URL}/${safeToken}.json`);
      if (!res.ok) {
        if (res.status === 404 || res.status === 403) {
          searchTokenCache.set(token, []);
          return [];
        }
        throw new Error(`Failed to load token: ${token}`);
      }
      const ids = await res.json();
      searchTokenCache.set(token, ids);
      return ids;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async function performSearch() {
    const phrases = searchPhrases.filter(p => p.trim());
    if (phrases.length === 0) {
      searchError = 'Please enter at least one search phrase';
      return;
    }

    searching = true;
    searchError = null;
    hasSearched = true;
    results = [];
    totalCount = 0;
    timelineData = [];

    try {
      // Load full dataset for filtering
      const dataset = await loadFullDataset();

      // Filter by date range
      let filtered = dataset.filter(item => {
        if (!item.date) return false;
        const itemDate = item.date.split('T')[0];
        return itemDate >= dateFrom && itemDate <= dateTo;
      });

      // Filter by institution if selected
      if (selectedInstitution) {
        filtered = filtered.filter(item =>
          item.institution?.toLowerCase() === selectedInstitution.toLowerCase()
        );
      }

      // Filter by search phrases (OR logic)
      const phraseMatches = new Set();
      for (const phrase of phrases) {
        const lowerPhrase = phrase.toLowerCase();
        for (const item of filtered) {
          const text = `${item.title || ''} ${item.content || ''} ${item.institution || ''}`.toLowerCase();
          if (text.includes(lowerPhrase)) {
            phraseMatches.add(item.id);
          }
        }
      }

      // Exclude phrases (AND NOT logic)
      const excludes = excludePhrases.filter(p => p.trim());
      let matchedItems = filtered.filter(item => phraseMatches.has(item.id));

      if (excludes.length > 0) {
        matchedItems = matchedItems.filter(item => {
          const text = `${item.title || ''} ${item.content || ''} ${item.institution || ''}`.toLowerCase();
          return !excludes.some(ex => text.includes(ex.toLowerCase()));
        });
      }

      // Sort by date descending
      matchedItems.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });

      results = matchedItems;
      totalCount = matchedItems.length;

      // Build timeline data
      const timelineCounts = {};
      for (const item of matchedItems) {
        if (item.date) {
          const monthKey = item.date.slice(0, 7); // YYYY-MM
          timelineCounts[monthKey] = (timelineCounts[monthKey] || 0) + 1;
        }
      }

      timelineData = Object.entries(timelineCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));

    } catch (e) {
      console.error('Search error:', e);
      searchError = e.message;
    } finally {
      searching = false;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
  }

  function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
  }

  async function downloadCSV() {
    if (results.length === 0) return;

    const headers = ['Title', 'Institution', 'Date', 'URL'];
    const rows = results.map(item => [
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${(item.institution || '').replace(/"/g, '""')}"`,
      item.date ? item.date.split('T')[0] : '',
      item.url || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onMount(() => {
    loadManifests();
  });
</script>

<div class="simple-database">
  <div class="container">
    <!-- Header -->
    <header class="page-header">
      <h1>Campus Data Search</h1>
      <p class="subtitle">Search university communications from January 2025 onwards</p>
    </header>

    <!-- Search Section -->
    <section class="search-section">
      <div class="search-row">
        <!-- Search Phrases -->
        <div class="search-group">
          <h3><span class="step-number">1</span> Enter search phrases</h3>
          <p class="group-help">Match <strong>Any</strong> of these phrases:</p>

          <div class="phrase-inputs">
            {#each searchPhrases as phrase, i}
              <div class="phrase-row">
                <input
                  type="text"
                  bind:value={searchPhrases[i]}
                  placeholder="Enter search phrase..."
                  class="phrase-input"
                />
                {#if i < searchPhrases.length - 1}
                  <span class="or-label">OR</span>
                {/if}
                {#if searchPhrases.length > 1}
                  <button class="remove-btn" onclick={() => removeSearchPhrase(i)} aria-label="Remove phrase">−</button>
                {/if}
              </div>
            {/each}
            <button class="add-btn" onclick={addSearchPhrase}>
              <span>+</span> Add phrase
            </button>
          </div>
        </div>
<br>
      <div class="search-row">
        <!-- Institution Filter -->
        <div class="search-group">
          <h3><span class="step-number">2</span> Pick institution</h3>
          <select bind:value={selectedInstitution} class="institution-select">
            <option value="">All institutions</option>
            {#each institutions as inst}
              <option value={inst}>{inst}</option>
            {/each}
          </select>
        </div>
<br>
        <!-- Date Picker -->
        <div class="search-group date-group">
          <h3><span class="step-number">3</span> Pick dates</h3>

          <div class="date-inputs">
            <div class="date-field">
              <label>From</label>
              <input type="date" bind:value={dateFrom} class="date-input" />
            </div>
            <div class="date-field">
              <label>To</label>
              <input type="date" bind:value={dateTo} class="date-input" />
            </div>
          </div>

          <div class="date-shortcuts">
            <button class="shortcut-btn" onclick={setLastMonth}>Last Month</button>
            <button class="shortcut-btn" onclick={setLast3Months}>Last Week</button>
          </div>

      </div>
<br>
      <!-- Search Button -->
      <div class="search-actions">
        <button class="search-btn" onclick={performSearch} disabled={searching}>
          {#if searching}
            Searching...
          {:else}
            Search
          {/if}
        </button>
        {#if searchError}
          <p class="error-text">{searchError}</p>
        {/if}
      </div>
    </section>

    <!-- Results Section -->
    {#if hasSearched && !searching}
      <section class="results-section">
        <!-- Timeline Chart -->
        <div class="results-block">
          <h2>Attention Over Time</h2>
          <p class="block-description">
            Compare the attention paid to your queries over time to understand how they are covered.
            This chart shows the number of stories that match each of your queries.
          </p>

          {#if timelineData.length > 0}
            {@const maxCount = Math.max(...timelineData.map(d => d.count), 1)}
            {@const points = timelineData.map((d, i) => {
              const x = 50 + (i / Math.max(timelineData.length - 1, 1)) * 700;
              const y = 180 - (d.count / maxCount) * 150;
              return `${x},${y}`;
            }).join(' ')}
            <div class="timeline-chart">
              <svg viewBox="0 0 800 200" class="chart-svg">
                <!-- Grid lines -->
                <line x1="50" y1="30" x2="50" y2="180" stroke="#e0e0e0" stroke-width="1" />
                <line x1="50" y1="180" x2="750" y2="180" stroke="#e0e0e0" stroke-width="1" />

                <!-- Y-axis labels -->
                <text x="40" y="35" text-anchor="end" class="axis-label">{maxCount}</text>
                <text x="40" y="180" text-anchor="end" class="axis-label">0</text>

                <!-- Line -->
                <polyline
                  fill="none"
                  stroke="#254C6F"
                  stroke-width="2"
                  points={points}
                />

                <!-- Data points -->
                {#each timelineData as d, i}
                  {@const x = 50 + (i / Math.max(timelineData.length - 1, 1)) * 700}
                  {@const y = 180 - (d.count / maxCount) * 150}
                  <circle cx={x} cy={y} r="4" fill="#254C6F" />
                {/each}

                <!-- X-axis labels -->
                {#each timelineData as d, i}
                  {#if i % Math.ceil(timelineData.length / 6) === 0 || i === timelineData.length - 1}
                    {@const x = 50 + (i / Math.max(timelineData.length - 1, 1)) * 700}
                    <text x={x} y="195" text-anchor="middle" class="axis-label">{formatMonthLabel(d.month)}</text>
                  {/if}
                {/each}
              </svg>
            </div>
          {:else}
            <p class="no-data">No timeline data available</p>
          {/if}
        </div>

        <!-- Total Attention -->
        <div class="results-row">
          <div class="results-block half">
            <h2>Total Attention</h2>
            <p class="block-description">
              Compare the total number of items that matched your queries.
            </p>

            <div class="total-bar">
              <div class="bar-label">Matching Content</div>
              <div class="bar-track">
                <div class="bar-fill" style="width: {Math.min(matchPercentage, 100)}%;"></div>
              </div>
              <div class="bar-value">{matchPercentage}%</div>
            </div>
          </div>

          <div class="results-block half">
            <h2>Total Stories Count</h2>

            <div class="count-display">
              <div class="count-number">{totalCount.toLocaleString()}</div>
              <div class="count-label">matching articles</div>
            </div>

            <div class="count-bar">
              <div class="count-bar-track">
                <div class="count-bar-fill" style="width: {Math.min(matchPercentage, 100)}%;"></div>
              </div>
              <div class="count-bar-labels">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Download Button -->
        <div class="download-row">
          <button class="download-btn" onclick={downloadCSV} disabled={results.length === 0}>
            Download All URLs ({totalCount.toLocaleString()} items)
          </button>
        </div>

        <!-- Sample Content -->
        <div class="results-block">
          <h2>Sample Content</h2>
          <p class="block-description">
            This is a sample of the content that matched your queries.
            These results are a random sample of news stories that matched your searches.
          </p>

          {#if sampleResults.length > 0}
            <div class="sample-table-wrapper">
              <table class="sample-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Source</th>
                    <th>Publication Date</th>
                  </tr>
                </thead>
                <tbody>
                  {#each sampleResults as item}
                    <tr>
                      <td class="title-cell">
                        {#if item.url}
                          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || 'Untitled'}</a>
                        {:else}
                          {item.title || 'Untitled'}
                        {/if}
                      </td>
                      <td class="source-cell">
                        <span class="source-icon">●</span>
                        {item.institution || 'Unknown'}
                      </td>
                      <td class="date-cell">{formatDate(item.date)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            {#if results.length > 10}
              <p class="sample-note">Showing 10 of {totalCount.toLocaleString()} results. Download CSV for full data.</p>
            {/if}
          {:else}
            <p class="no-data">No results found</p>
          {/if}
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .simple-database {
    background: #fff;
    min-height: 100vh;
    font-family: "Graphik Web", -apple-system, sans-serif;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 3rem;
  }

  /* Header */
  .page-header {
    margin-bottom: 2rem;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 1.5rem;
  }

  .page-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #222;
    margin: 0 0 0.5rem;
    font-family: "Lyon Display Web", Georgia, serif;
  }

  .subtitle {
    color: #666;
    font-size: 1rem;
    margin: 0;
  }

  /* Search Section */
  .search-section {
    background: #fafafa;
    border: 1px solid #e0e0e0;
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .search-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .search-row:last-of-type {
    grid-template-columns: 1fr 2fr;
  }

  .search-group h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #333;
    margin: 0 0 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: #254C6F;
    color: white;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .group-help {
    font-size: 0.9rem;
    color: #666;
    margin: 0 0 0.75rem;
  }

  /* Phrase Inputs */
  .phrase-inputs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .phrase-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .phrase-input {
    flex: 1;
    padding: 0.6rem 0.75rem;
    border: 1px solid #ccc;
    font-size: 0.95rem;
    font-family: inherit;
  }

  .phrase-input:focus {
    outline: none;
    border-color: #254C6F;
  }

  .phrase-input.exclude {
    border-color: #999;
  }

  .or-label {
    font-size: 0.8rem;
    color: #888;
    font-weight: 500;
    min-width: 30px;
    text-align: center;
  }

  .remove-btn {
    width: 28px;
    height: 28px;
    border: 1px solid #254C6F;
    background: white;
    color: #254C6F;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    background: #254C6F;
    color: white;
  }

  .add-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    color: #254C6F;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.5rem 0;
    font-family: inherit;
  }

  .add-btn:hover {
    text-decoration: underline;
  }

  .add-btn span {
    font-size: 1.1rem;
    font-weight: 600;
  }

  /* Query Preview */
  .preview-group {
    background: #f0f0f0;
    padding: 1rem;
    border: 1px dashed #ccc;
  }

  .query-preview {
    font-family: monospace;
    font-size: 0.9rem;
    color: #333;
    word-break: break-word;
  }

  .query-preview .placeholder {
    color: #999;
    font-style: italic;
    font-family: inherit;
  }

  /* Institution Select */
  .institution-select {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid #ccc;
    font-size: 0.95rem;
    font-family: inherit;
    background: white;
  }

  /* Date Inputs */
  .date-group {
    grid-column: span 1;
  }

  .date-inputs {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .date-field {
    flex: 1;
  }

  .date-field label {
    display: block;
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .date-input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid #ccc;
    font-size: 0.95rem;
    font-family: inherit;
  }

  .date-shortcuts {
    display: flex;
    gap: 0.5rem;
  }

  .shortcut-btn {
    padding: 0.4rem 1rem;
    border: 1px solid #254C6F;
    background: white;
    color: #254C6F;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .shortcut-btn:hover {
    background: #254C6F;
    color: white;
  }

  /* Search Actions */
  .search-actions {
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
  }

  .search-btn {
    background: #254C6F;
    color: white;
    border: none;
    padding: 0.75rem 3rem;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .search-btn:hover:not(:disabled) {
    background: #b34700;
  }

  .search-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .error-text {
    color: #dc3545;
    margin: 1rem 0 0;
  }

  /* Results Section */
  .results-section {
    margin-top: 3rem;
  }

  .results-block {
    margin-bottom: 3rem;
  }

  .results-block h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #222;
    margin: 0 0 0.5rem;
    font-family: "Lyon Display Web", Georgia, serif;
  }

  .block-description {
    color: #666;
    font-size: 0.95rem;
    margin: 0 0 1.5rem;
    max-width: 600px;
  }

  .results-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .results-block.half {
    margin-bottom: 0;
  }

  /* Timeline Chart */
  .timeline-chart {
    background: #fafafa;
    padding: 1rem;
    border: 1px solid #e0e0e0;
  }

  .chart-svg {
    width: 100%;
    height: auto;
  }

  .axis-label {
    font-size: 11px;
    fill: #666;
  }

  /* Total Bar */
  .total-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .bar-label {
    font-size: 0.9rem;
    color: #333;
    min-width: 120px;
  }

  .bar-track {
    flex: 1;
    height: 24px;
    background: #e0e0e0;
  }

  .bar-fill {
    height: 100%;
    background: #333;
    transition: width 0.3s;
  }

  .bar-value {
    font-size: 0.9rem;
    font-weight: 600;
    color: #333;
    min-width: 60px;
  }

  /* Count Display */
  .count-display {
    margin-bottom: 1rem;
  }

  .count-number {
    font-size: 2.5rem;
    font-weight: 700;
    color: #222;
    font-family: "Lyon Display Web", Georgia, serif;
  }

  .count-label {
    font-size: 0.9rem;
    color: #666;
  }

  .count-bar-track {
    height: 20px;
    background: linear-gradient(to right, #f0f0f0 0%, #e0e0e0 100%);
    margin-bottom: 0.25rem;
  }

  .count-bar-fill {
    height: 100%;
    background: #254C6F;
  }

  .count-bar-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #888;
  }

  /* Download Row */
  .download-row {
    text-align: right;
    margin-bottom: 2rem;
  }

  .download-btn {
    background: white;
    border: 1px solid #254C6F;
    color: #254C6F;
    padding: 0.6rem 1.5rem;
    font-size: 0.95rem;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .download-btn:hover:not(:disabled) {
    background: #254C6F;
    color: white;
  }

  .download-btn:disabled {
    border-color: #ccc;
    color: #ccc;
    cursor: not-allowed;
  }

  /* Sample Table */
  .sample-table-wrapper {
    overflow-x: auto;
  }

  .sample-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .sample-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: #f5f5f5;
    border-bottom: 2px solid #254C6F;
    font-weight: 600;
    color: #333;
  }

  .sample-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e0e0e0;
    vertical-align: top;
  }

  .sample-table tr:hover {
    background: #fafafa;
  }

  .title-cell {
    max-width: 400px;
  }

  .title-cell a {
    color: #0066cc;
    text-decoration: none;
  }

  .title-cell a:hover {
    text-decoration: underline;
  }

  .source-cell {
    white-space: nowrap;
  }

  .source-icon {
    color: #254C6F;
    margin-right: 0.25rem;
  }

  .date-cell {
    white-space: nowrap;
    color: #666;
  }

  .sample-note {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #666;
    font-style: italic;
  }

  .no-data {
    color: #888;
    font-style: italic;
    padding: 2rem;
    text-align: center;
    background: #fafafa;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .search-row {
      grid-template-columns: 1fr;
    }

    .search-row:last-of-type {
      grid-template-columns: 1fr;
    }

    .results-row {
      grid-template-columns: 1fr;
    }
  }
</style>
