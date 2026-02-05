<script>
  import { onMount } from 'svelte';

  // Data URLs
  const FULL_DATA_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';
  const MONTH_INDEX_MANIFEST_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/month_index/manifest.json';
  const INSTITUTION_INDEX_MANIFEST_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/institution_index/manifest.json';

  // Suggested search topics
  const suggestedTopics = [
    'DEI',
    'Title IX',
    'antisemitism',
    'free speech',
    'federal funding',
    'immigration',
    'protest'
  ];

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
  let totalTimelineData = [];
  let institutions = [];
  let selectedInstitutions = [];

  // Boolean tooltip
  let showBooleanTooltip = false;

  // Chart tooltip
  let chartTooltip = null;
  let chartTooltipX = 0;
  let chartTooltipY = 0;
  let chartContainer;

  // Data caches
  let monthManifest = null;
  let institutionManifest = null;
  let fullDatasetCache = null;

  // Derived
  $: sampleResults = results.slice(0, 10);
  $: totalInDataset = Object.values(monthManifest || {}).reduce((sum, yearData) => {
    return sum + Object.values(yearData).reduce((s, count) => s + count, 0);
  }, 0);
  $: matchPercentage = totalInDataset > 0 ? ((totalCount / totalInDataset) * 100).toFixed(2) : 0;
  $: hasKeywordSearch = searchPhrases.some(p => p.trim());
  $: queryPreview = getQueryPreview();

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

  function applySuggestedTopic(topic) {
    const emptyIndex = searchPhrases.findIndex(p => !p.trim());
    if (emptyIndex >= 0) {
      searchPhrases[emptyIndex] = topic;
      searchPhrases = [...searchPhrases];
    } else {
      searchPhrases = [...searchPhrases, topic];
    }
  }

  function toggleInstitution(inst) {
    if (selectedInstitutions.includes(inst)) {
      selectedInstitutions = selectedInstitutions.filter(i => i !== inst);
    } else {
      selectedInstitutions = [...selectedInstitutions, inst];
    }
  }

  function clearInstitutions() {
    selectedInstitutions = [];
  }

  function getQueryPreview() {
    const phrases = searchPhrases.filter(p => p.trim());
    const excludes = excludePhrases.filter(p => p.trim());
    if (phrases.length === 0) return 'All articles';
    let query = phrases.map(p => `"${p}"`).join(' OR ');
    if (excludes.length > 0) {
      query += ' AND NOT (' + excludes.map(p => `"${p}"`).join(' OR ') + ')';
    }
    return query;
  }

  // Chart tooltip handlers
  function handleChartPointHover(info, event) {
    chartTooltip = info;
    if (chartContainer) {
      const rect = chartContainer.getBoundingClientRect();
      chartTooltipX = event.clientX - rect.left;
      chartTooltipY = event.clientY - rect.top - 50;
    }
  }

  function handleChartPointLeave() {
    chartTooltip = null;
  }

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
        // Extract institution names from the manifest structure
        const names = new Set();
        Object.values(institutionManifest).forEach(group => {
          if (group && typeof group === 'object') {
            Object.keys(group).forEach(name => names.add(name));
          }
        });
        institutions = [...names].sort();
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

  async function performSearch() {
    const phrases = searchPhrases.filter(p => p.trim());

    searching = true;
    searchError = null;
    hasSearched = true;
    results = [];
    totalCount = 0;
    timelineData = [];
    totalTimelineData = [];

    try {
      const dataset = await loadFullDataset();

      // Filter by date range
      let filtered = dataset.filter(item => {
        if (!item.date) return false;
        const itemDate = (typeof item.date === 'string' ? item.date : item.date?.$date || '').split('T')[0];
        return itemDate >= dateFrom && itemDate <= dateTo;
      });

      // Filter by institutions if selected
      if (selectedInstitutions.length > 0) {
        const selectedLower = selectedInstitutions.map(i => i.toLowerCase());
        filtered = filtered.filter(item =>
          selectedLower.includes((item.institution || '').toLowerCase())
        );
      }

      // Build total timeline data (all articles in scope regardless of keyword)
      const totalTimelineCounts = {};
      for (const item of filtered) {
        const dateStr = (typeof item.date === 'string' ? item.date : item.date?.$date || '').split('T')[0];
        if (dateStr) {
          const monthKey = dateStr.slice(0, 7);
          totalTimelineCounts[monthKey] = (totalTimelineCounts[monthKey] || 0) + 1;
        }
      }
      totalTimelineData = Object.entries(totalTimelineCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));

      let matchedItems;
      if (phrases.length === 0) {
        matchedItems = filtered;
      } else {
        const phraseMatches = new Set();
        for (const phrase of phrases) {
          const lowerPhrase = phrase.toLowerCase();
          for (const item of filtered) {
            const text = `${item.title || ''} ${item.content || ''} ${item.institution || ''}`.toLowerCase();
            if (text.includes(lowerPhrase)) {
              phraseMatches.add(item.id || item._id?.$oid || item.url);
            }
          }
        }

        const excludes = excludePhrases.filter(p => p.trim());
        matchedItems = filtered.filter(item => phraseMatches.has(item.id || item._id?.$oid || item.url));

        if (excludes.length > 0) {
          matchedItems = matchedItems.filter(item => {
            const text = `${item.title || ''} ${item.content || ''} ${item.institution || ''}`.toLowerCase();
            return !excludes.some(ex => text.includes(ex.toLowerCase()));
          });
        }
      }

      // Sort by date descending
      matchedItems.sort((a, b) => {
        const dateA = (typeof a.date === 'string' ? a.date : a.date?.$date || '');
        const dateB = (typeof b.date === 'string' ? b.date : b.date?.$date || '');
        return dateB.localeCompare(dateA);
      });

      results = matchedItems;
      totalCount = matchedItems.length;

      // Build keyword timeline data
      const timelineCounts = {};
      for (const item of matchedItems) {
        const dateStr = (typeof item.date === 'string' ? item.date : item.date?.$date || '').split('T')[0];
        if (dateStr) {
          const monthKey = dateStr.slice(0, 7);
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

  function getItemDate(item) {
    const raw = typeof item.date === 'string' ? item.date : item.date?.$date || '';
    return raw.split('T')[0];
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = typeof dateStr === 'string' ? dateStr : dateStr?.$date || '';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
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
      getItemDate(item),
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

    <!-- Suggested Topics -->
    <section class="suggested-topics">
      <span class="topics-label">Suggested topics:</span>
      <div class="topics-buttons">
        {#each suggestedTopics as topic}
          <button class="topic-btn" onclick={() => applySuggestedTopic(topic)}>
            {topic}
          </button>
        {/each}
      </div>
    </section>

    <!-- Search Section -->
    <section class="search-section">
      <div class="search-row">
        <!-- Search Phrases -->
        <div class="search-group">
          <h3><span class="step-number">1</span> Enter search phrases</h3>
          <p class="group-help">Match <strong>Any</strong> of these phrases (leave empty for all articles):</p>

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

        <!-- Exclude Phrases -->
        <div class="search-group">
          <h3>And <strong>none</strong> of these phrases:</h3>
          <div class="phrase-inputs">
            {#each excludePhrases as phrase, i}
              <div class="phrase-row">
                <input
                  type="text"
                  bind:value={excludePhrases[i]}
                  placeholder="Exclude phrase..."
                  class="phrase-input exclude"
                />
                {#if excludePhrases.length > 1}
                  <button class="remove-btn" onclick={() => removeExcludePhrase(i)} aria-label="Remove phrase">−</button>
                {/if}
              </div>
            {/each}
            <button class="add-btn" onclick={addExcludePhrase}>
              <span>+</span> Add exclusion
            </button>
          </div>
        </div>

        <!-- Boolean Search Help - hover tooltip -->
        <div class="search-group help-group">
          <h3>
            Query preview
            <span
              class="boolean-help-icon"
              onmouseenter={() => showBooleanTooltip = true}
              onmouseleave={() => showBooleanTooltip = false}
              role="button"
              tabindex="0"
            >?</span>
            {#if showBooleanTooltip}
              <div class="boolean-tooltip">
                <div class="boolean-tooltip-content">
                  <p><strong>Boolean search tips:</strong></p>
                  <ul>
                    <li><strong>OR logic:</strong> Add multiple phrases to match any of them</li>
                    <li><strong>AND NOT:</strong> Use exclusions to filter out unwanted results</li>
                    <li><strong>Exact match:</strong> Phrases are matched exactly as entered</li>
                    <li><strong>Empty search:</strong> Leave phrases empty and press Search to browse all articles</li>
                  </ul>
                </div>
              </div>
            {/if}
          </h3>
          <div class="query-preview">
            {#if queryPreview}
              <code>{queryPreview}</code>
            {:else}
              <span class="placeholder">Enter phrases to see query</span>
            {/if}
          </div>
        </div>
      </div>

      <div class="search-row row-2">
        <!-- Institution Filter (Multi-select) -->
        <div class="search-group institution-group">
          <h3><span class="step-number">2</span> Pick institutions</h3>
          <p class="group-help">Select one or more institutions (leave empty for all):</p>

          {#if selectedInstitutions.length > 0}
            <div class="selected-institutions">
              {#each selectedInstitutions as inst}
                <span class="selected-tag">
                  {inst}
                  <button class="tag-remove" onclick={() => toggleInstitution(inst)}>×</button>
                </span>
              {/each}
              <button class="clear-all-btn" onclick={clearInstitutions}>Clear all</button>
            </div>
          {/if}

          <div class="institution-list">
            {#each institutions as inst}
              <label class="institution-checkbox">
                <input
                  type="checkbox"
                  checked={selectedInstitutions.includes(inst)}
                  onchange={() => toggleInstitution(inst)}
                />
                <span>{inst}</span>
              </label>
            {/each}
            {#if institutions.length === 0}
              <div class="loading-institutions">Loading institutions...</div>
            {/if}
          </div>
        </div>

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
            <button class="shortcut-btn" onclick={setLast3Months}>Last 3 Months</button>
          </div>
        </div>
      </div>

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
        <!-- Query Preview in Results -->
        <div class="query-result-preview">
          <span class="preview-label">Search query:</span>
          <code>{queryPreview}</code>
          {#if selectedInstitutions.length > 0}
            <span class="preview-institutions">
              in {selectedInstitutions.length} institution{selectedInstitutions.length > 1 ? 's' : ''}
            </span>
          {/if}
        </div>

        <!-- Timeline Chart -->
        <div class="results-block">
          <h2>Attention Over Time</h2>
          <p class="block-description">
            {#if hasKeywordSearch}
              Compare keyword matches (blue) against total articles (gray dashed) in your selected scope.
            {:else}
              Total articles over time in your selected date range and institutions.
            {/if}
          </p>

          {#if totalTimelineData.length > 0}
            {@const allMonths = [...new Set([...totalTimelineData.map(d => d.month), ...timelineData.map(d => d.month)])].sort()}
            {@const maxCount = Math.max(...totalTimelineData.map(d => d.count), ...timelineData.map(d => d.count), 1)}
            {@const totalMap = new Map(totalTimelineData.map(d => [d.month, d.count]))}
            {@const keywordMap = new Map(timelineData.map(d => [d.month, d.count]))}
            {@const totalPoints = allMonths.map((month, i) => {
              const x = 50 + (i / Math.max(allMonths.length - 1, 1)) * 700;
              const y = 180 - ((totalMap.get(month) || 0) / maxCount) * 150;
              return `${x},${y}`;
            }).join(' ')}
            {@const keywordPoints = allMonths.map((month, i) => {
              const x = 50 + (i / Math.max(allMonths.length - 1, 1)) * 700;
              const y = 180 - ((keywordMap.get(month) || 0) / maxCount) * 150;
              return `${x},${y}`;
            }).join(' ')}
            <div class="timeline-chart" bind:this={chartContainer}>
              <svg viewBox="0 0 800 220" class="chart-svg">
                <!-- Grid lines -->
                <line x1="50" y1="30" x2="50" y2="180" stroke="#e0e0e0" stroke-width="1" />
                <line x1="50" y1="180" x2="750" y2="180" stroke="#e0e0e0" stroke-width="1" />

                <!-- Y-axis labels -->
                <text x="40" y="35" text-anchor="end" class="axis-label">{maxCount}</text>
                <text x="40" y="180" text-anchor="end" class="axis-label">0</text>

                <!-- Total articles line (gray dashed) -->
                <polyline
                  fill="none"
                  stroke="#999"
                  stroke-width="2"
                  stroke-dasharray="4,4"
                  points={totalPoints}
                />

                {#if hasKeywordSearch}
                  <!-- Keyword matches line (blue solid) -->
                  <polyline
                    fill="none"
                    stroke="#254c6f"
                    stroke-width="2"
                    points={keywordPoints}
                  />

                  <!-- Keyword data points with hover -->
                  {#each allMonths as month, i}
                    {@const x = 50 + (i / Math.max(allMonths.length - 1, 1)) * 700}
                    {@const kwCount = keywordMap.get(month) || 0}
                    {@const totCount = totalMap.get(month) || 0}
                    {@const y = 180 - (kwCount / maxCount) * 150}
                    <circle
                      cx={x} cy={y} r="5"
                      fill="#254c6f"
                      class="chart-point"
                      onmouseenter={(e) => handleChartPointHover({ month, keyword: kwCount, total: totCount }, e)}
                      onmouseleave={handleChartPointLeave}
                    />
                  {/each}
                {:else}
                  <!-- Total data points when no keyword -->
                  {#each allMonths as month, i}
                    {@const x = 50 + (i / Math.max(allMonths.length - 1, 1)) * 700}
                    {@const count = totalMap.get(month) || 0}
                    {@const y = 180 - (count / maxCount) * 150}
                    <circle
                      cx={x} cy={y} r="5"
                      fill="#254c6f"
                      class="chart-point"
                      onmouseenter={(e) => handleChartPointHover({ month, total: count }, e)}
                      onmouseleave={handleChartPointLeave}
                    />
                  {/each}
                {/if}

                <!-- Total article points (gray, smaller) -->
                {#if hasKeywordSearch}
                  {#each allMonths as month, i}
                    {@const x = 50 + (i / Math.max(allMonths.length - 1, 1)) * 700}
                    {@const count = totalMap.get(month) || 0}
                    {@const y = 180 - (count / maxCount) * 150}
                    <circle cx={x} cy={y} r="3" fill="#999" class="chart-point-secondary" />
                  {/each}
                {/if}

                <!-- X-axis labels -->
                {#each allMonths as month, i}
                  {#if i % Math.ceil(allMonths.length / 6) === 0 || i === allMonths.length - 1}
                    {@const x = 50 + (i / Math.max(allMonths.length - 1, 1)) * 700}
                    <text x={x} y="200" text-anchor="middle" class="axis-label">{formatMonthLabel(month)}</text>
                  {/if}
                {/each}
              </svg>

              <!-- Chart tooltip -->
              {#if chartTooltip}
                <div class="chart-tooltip" style="left: {chartTooltipX}px; top: {chartTooltipY}px;">
                  <div class="chart-tooltip-content">
                    <div class="chart-tooltip-month">{formatMonthLabel(chartTooltip.month)}</div>
                    {#if chartTooltip.keyword !== undefined}
                      <div class="chart-tooltip-row">
                        <span class="chart-tooltip-dot keyword"></span>
                        Keyword matches: <strong>{chartTooltip.keyword.toLocaleString()}</strong>
                      </div>
                    {/if}
                    <div class="chart-tooltip-row">
                      <span class="chart-tooltip-dot total"></span>
                      Total articles: <strong>{chartTooltip.total.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Legend -->
              {#if hasKeywordSearch}
                <div class="chart-legend">
                  <div class="legend-item">
                    <span class="legend-line solid"></span>
                    <span>Keyword matches</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-line dashed"></span>
                    <span>Total articles</span>
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <p class="no-data">No timeline data available</p>
          {/if}
        </div>

        <!-- Total Attention + Count -->
        <div class="results-row">
          <div class="results-block half">
            <h2>Total Attention</h2>
            <p class="block-description">
              {#if hasKeywordSearch}
                Percentage of articles matching your keywords out of total in scope.
              {:else}
                Articles in your selected date range and institutions.
              {/if}
            </p>
            <div class="total-bar">
              <div class="bar-label">{hasKeywordSearch ? 'Keyword Match Rate' : 'Articles Found'}</div>
              <div class="bar-track">
                <div class="bar-fill" style="width: {hasKeywordSearch ? Math.min(matchPercentage, 100) : 100}%;"></div>
              </div>
              <div class="bar-value">{hasKeywordSearch ? `${matchPercentage}%` : `${totalCount.toLocaleString()}`}</div>
            </div>
          </div>

          <div class="results-block half">
            <h2>Total Stories Count</h2>
            <div class="count-display">
              <div class="count-number">{totalCount.toLocaleString()}</div>
              <div class="count-label">matching articles</div>
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
            A sample of content that matched your queries.
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
    font-family: 'Lyon Text Web', 'Georgia', serif;
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem 3rem;
  }

  /* Header */
  .page-header {
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 1.5rem;
  }

  .page-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #254c6f;
    margin: 0 0 0.5rem;
    font-family: 'Lyon Display Web', 'Georgia', serif;
  }

  .subtitle {
    color: #666;
    font-size: 1rem;
    margin: 0;
  }

  /* Suggested Topics */
  .suggested-topics {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .topics-label {
    font-size: 0.9rem;
    color: #666;
    font-weight: 500;
  }

  .topics-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .topic-btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid #254c6f;
    background: white;
    color: #254c6f;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: 'Lyon Text Web', 'Georgia', serif;
    border-radius: 3px;
    transition: all 0.15s;
  }

  .topic-btn:hover {
    background: #254c6f;
    color: white;
  }

  /* Search Section */
  .search-section {
    background: #f8fafc;
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

  .search-row.row-2 {
    grid-template-columns: 1.5fr 1fr;
  }

  .search-group h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #333;
    margin: 0 0 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
  }

  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: #254c6f;
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

  /* Boolean tooltip */
  .boolean-help-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: #254c6f;
    color: white;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    position: relative;
  }

  .boolean-tooltip {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 100;
    margin-top: 0.5rem;
  }

  .boolean-tooltip-content {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    min-width: 280px;
    font-weight: normal;
    font-size: 0.9rem;
    animation: tooltipAppear 0.15s ease;
  }

  @keyframes tooltipAppear {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .boolean-tooltip-content p {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
  }

  .boolean-tooltip-content ul {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.85rem;
    color: #555;
  }

  .boolean-tooltip-content li {
    margin-bottom: 0.35rem;
  }

  /* Query Preview */
  .help-group {
    padding: 1rem;
    border: 1px dashed #d0dce5;
    background: #eef3f7;
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
    font-family: 'Lyon Text Web', 'Georgia', serif;
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
    font-family: 'Lyon Text Web', 'Georgia', serif;
  }

  .phrase-input:focus {
    outline: none;
    border-color: #254c6f;
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
    border: 1px solid #254c6f;
    background: white;
    color: #254c6f;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    background: #254c6f;
    color: white;
  }

  .add-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    color: #254c6f;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.5rem 0;
    font-family: 'Lyon Text Web', 'Georgia', serif;
  }

  .add-btn:hover {
    text-decoration: underline;
  }

  .add-btn span {
    font-size: 1.1rem;
    font-weight: 600;
  }

  /* Institution Multi-select */
  .institution-group {
    max-height: 320px;
    display: flex;
    flex-direction: column;
  }

  .selected-institutions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .selected-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #254c6f;
    color: white;
    font-size: 0.85rem;
    border-radius: 3px;
  }

  .tag-remove {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
    margin-left: 0.25rem;
  }

  .tag-remove:hover {
    opacity: 0.8;
  }

  .clear-all-btn {
    background: none;
    border: none;
    color: #666;
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;
    font-family: 'Lyon Text Web', 'Georgia', serif;
  }

  .institution-list {
    flex: 1;
    overflow-y: auto;
    max-height: 180px;
    border: 1px solid #ccc;
    background: white;
    padding: 0.5rem;
  }

  .institution-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .institution-checkbox:hover {
    background: #f5f5f5;
  }

  .institution-checkbox input {
    cursor: pointer;
  }

  .loading-institutions {
    padding: 1rem;
    color: #999;
    font-style: italic;
    text-align: center;
  }

  /* Date Inputs */
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
    font-family: 'Lyon Text Web', 'Georgia', serif;
  }

  .date-shortcuts {
    display: flex;
    gap: 0.5rem;
  }

  .shortcut-btn {
    padding: 0.4rem 1rem;
    border: 1px solid #254c6f;
    background: white;
    color: #254c6f;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: 'Lyon Text Web', 'Georgia', serif;
    transition: all 0.15s;
  }

  .shortcut-btn:hover {
    background: #254c6f;
    color: white;
  }

  /* Search Actions */
  .search-actions {
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
  }

  .search-btn {
    background: #254c6f;
    color: white;
    border: none;
    padding: 0.75rem 3rem;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Lyon Text Web', 'Georgia', serif;
    transition: all 0.15s;
  }

  .search-btn:hover:not(:disabled) {
    background: #1a3a54;
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
    margin-top: 2rem;
  }

  .query-result-preview {
    background: #eef3f7;
    padding: 1rem 1.5rem;
    margin-bottom: 2rem;
    border-left: 4px solid #254c6f;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .preview-label {
    font-size: 0.9rem;
    color: #666;
    font-weight: 500;
  }

  .query-result-preview code {
    font-family: monospace;
    font-size: 0.95rem;
    color: #254c6f;
    background: white;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
  }

  .preview-institutions {
    font-size: 0.9rem;
    color: #666;
  }

  .results-block {
    margin-bottom: 3rem;
  }

  .results-block h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #254c6f;
    margin: 0 0 0.5rem;
    font-family: 'Lyon Display Web', 'Georgia', serif;
  }

  .block-description {
    color: #666;
    font-size: 0.95rem;
    margin: 0 0 1.5rem;
    max-width: 700px;
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
    position: relative;
  }

  .chart-svg {
    width: 100%;
    height: auto;
  }

  .axis-label {
    font-size: 11px;
    fill: #666;
    font-family: 'Lyon Text Web', 'Georgia', serif;
  }

  .chart-point {
    cursor: pointer;
    transition: r 0.15s;
  }

  .chart-point:hover {
    r: 7;
  }

  .chart-point-secondary {
    pointer-events: none;
  }

  /* Chart Tooltip */
  .chart-tooltip {
    position: absolute;
    z-index: 100;
    pointer-events: none;
  }

  .chart-tooltip-content {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 180px;
    animation: tooltipAppear 0.15s ease;
  }

  .chart-tooltip-month {
    font-weight: 600;
    color: #222;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  .chart-tooltip-row {
    font-size: 0.85rem;
    color: #555;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chart-tooltip-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chart-tooltip-dot.keyword {
    background: #254c6f;
  }

  .chart-tooltip-dot.total {
    background: #999;
  }

  .chart-legend {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #666;
  }

  .legend-line {
    width: 24px;
    height: 2px;
  }

  .legend-line.solid {
    background: #254c6f;
  }

  .legend-line.dashed {
    background: repeating-linear-gradient(to right, #999 0, #999 4px, transparent 4px, transparent 8px);
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
    min-width: 140px;
  }

  .bar-track {
    flex: 1;
    height: 24px;
    background: #e0e0e0;
  }

  .bar-fill {
    height: 100%;
    background: #254c6f;
    transition: width 0.3s;
  }

  .bar-value {
    font-size: 0.9rem;
    font-weight: 600;
    color: #254c6f;
    min-width: 80px;
  }

  /* Count Display */
  .count-display {
    margin-bottom: 0;
  }

  .count-number {
    font-size: 2.5rem;
    font-weight: 700;
    color: #254c6f;
    font-family: 'Lyon Display Web', 'Georgia', serif;
  }

  .count-label {
    font-size: 0.9rem;
    color: #666;
  }

  /* Download Row */
  .download-row {
    text-align: right;
    margin-bottom: 2rem;
  }

  .download-btn {
    background: white;
    border: 1px solid #254c6f;
    color: #254c6f;
    padding: 0.6rem 1.5rem;
    font-size: 0.95rem;
    cursor: pointer;
    font-family: 'Lyon Text Web', 'Georgia', serif;
    transition: all 0.15s;
  }

  .download-btn:hover:not(:disabled) {
    background: #254c6f;
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
    border-bottom: 2px solid #254c6f;
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
    color: #254c6f;
    text-decoration: none;
  }

  .title-cell a:hover {
    text-decoration: underline;
  }

  .source-cell {
    white-space: nowrap;
  }

  .source-icon {
    color: #254c6f;
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
  @media (max-width: 1000px) {
    .search-row, .search-row.row-2 {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .results-row {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
    }

    .search-row, .search-row.row-2 {
      gap: 0.75rem;
    }

    button, .btn {
      min-height: 44px;
      padding: 0.75rem 1rem;
      touch-action: manipulation;
    }

    input, select, textarea {
      min-height: 44px;
      font-size: 16px; /* Prevents zoom on iOS */
    }

    a {
      min-height: 32px;
      touch-action: manipulation;
    }
  }
</style>
