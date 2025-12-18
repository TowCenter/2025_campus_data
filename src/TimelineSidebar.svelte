<script>
  import { onMount } from 'svelte';

  export let monthIndex = {};
  export let activeIds = [];  // Filtered article IDs
  export let onMonthClick = () => {};
  export let currentMonth = null;

  let timeline = [];
  let expandedYears = new Set();

  // Generate timeline from monthIndex
  onMount(() => {
    generateTimeline();
    // Expand current year by default
    const currentYear = new Date().getFullYear();
    expandedYears.add(currentYear);
    expandedYears = expandedYears;
  });

  function generateTimeline() {
    const yearMonths = {};

    // Create set of active IDs for fast lookup
    const activeIdSet = activeIds.length > 0 ? new Set(activeIds) : null;

    Object.keys(monthIndex).forEach(key => {
      if (key === '_no_date') return;

      const [year, month] = key.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      // Only include January 2025 onwards
      if (yearNum < 2025 || (yearNum === 2025 && monthNum < 1)) {
        return;
      }

      // Filter month IDs to only include active (filtered) IDs
      const monthIds = monthIndex[key];
      const filteredIds = activeIdSet
        ? monthIds.filter(id => activeIdSet.has(id))
        : monthIds;

      const count = filteredIds.length;

      // Skip months with no articles after filtering
      if (count === 0) return;

      if (!yearMonths[yearNum]) {
        yearMonths[yearNum] = {
          year: yearNum,
          total: 0,
          months: []
        };
      }

      yearMonths[yearNum].total += count;
      yearMonths[yearNum].months.push({
        month: monthNum,
        monthName: new Date(yearNum, monthNum - 1).toLocaleString('en-US', { month: 'long' }),
        key: key,
        count: count
      });
    });

    // Convert to array and sort
    timeline = Object.values(yearMonths)
      .sort((a, b) => b.year - a.year) // Newest first
      .map(year => ({
        ...year,
        months: year.months.sort((a, b) => b.month - a.month) // Dec to Jan
      }));
  }

  function toggleYear(year) {
    if (expandedYears.has(year)) {
      expandedYears.delete(year);
    } else {
      expandedYears.add(year);
    }
    expandedYears = expandedYears;
  }

  function handleMonthClick(monthKey) {
    onMonthClick(monthKey);
  }

  function formatCount(count) {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
  }

  // Regenerate timeline when monthIndex or activeIds change
  $: {
    // Reference both variables so Svelte tracks them
    monthIndex;
    activeIds;
    if (monthIndex && Object.keys(monthIndex).length > 0) {
      generateTimeline();
    }
  }
</script>

<aside class="timeline-sidebar">
  <h3>Timeline</h3>

  <div class="timeline-list">
    {#each timeline as yearData}
      <div class="year-section">
        <!-- Year Header -->
        <button
          class="year-header"
          class:expanded={expandedYears.has(yearData.year)}
          onclick={() => toggleYear(yearData.year)}
          type="button"
        >
          <div class="year-content">
            <span class="expand-icon">{expandedYears.has(yearData.year) ? '−' : '+'}</span>
            <span class="year">{yearData.year}</span>
          </div>
          <span class="count">{formatCount(yearData.total)}</span>
        </button>

        <!-- Month List (collapsible) -->
        {#if expandedYears.has(yearData.year)}
          <div class="months">
            {#each yearData.months as monthData}
              <button
                class="month-item"
                class:active={currentMonth === monthData.key}
                onclick={() => handleMonthClick(monthData.key)}
                type="button"
              >
                <span class="month-name">{monthData.monthName}</span>
                <span class="count">{formatCount(monthData.count)}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</aside>

<style>
  .timeline-sidebar {
    width: 120px;
    height: 100vh;
    position: sticky;
    top: 0;
    overflow-y: auto;
    padding: 220px 12px 20px 0;
    background: white;
    flex-shrink: 0;
  }

  h3 {
    margin: 0 0 16px 0;
    font-size: 12px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .year-section {
    margin-bottom: 0;
  }

  .year-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    background: transparent;
    border: none;
    cursor: pointer;
    font-weight: 400;
    font-size: 14px;
    transition: all 0.15s;
    color: #333;
  }

  .year-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .expand-icon {
    font-size: 12px;
    color: #999;
    font-weight: 400;
    width: 12px;
    text-align: center;
  }

  .year-header:hover {
    color: #000;
  }

  .year-header:hover .expand-icon {
    color: #666;
  }

  .months {
    margin-top: 2px;
    margin-bottom: 4px;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .month-item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s;
    color: #666;
    text-align: left;
  }

  .month-item:hover {
    color: #000;
  }

  .month-item.active {
    color: #0066cc;
    font-weight: 500;
  }

  .count {
    color: #999;
    font-size: 11px;
    margin-left: 4px;
    font-weight: 400;
  }

  .year-header .count {
    font-size: 12px;
    color: #999;
  }

  /* Scrollbar styling */
  .timeline-sidebar::-webkit-scrollbar {
    width: 4px;
  }

  .timeline-sidebar::-webkit-scrollbar-track {
    background: transparent;
  }

  .timeline-sidebar::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 2px;
  }

  .timeline-sidebar::-webkit-scrollbar-thumb:hover {
    background: #bbb;
  }
</style>
